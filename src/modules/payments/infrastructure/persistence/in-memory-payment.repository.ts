import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { Payment } from '../../domain/entities/payment.entity';
import { PaymentReferenceAlreadyExistsError } from '../../domain/errors/payment-reference-already-exists.error';
import {
  PaginatedPayments,
  PaymentFilters,
  PaymentRepository,
  Pagination,
} from '../../domain/repositories/payment.repository';
import { PaymentId } from '../../domain/value-objects/payment-id.vo';
import {
  PaymentMapper,
  PaymentPersistenceModel,
} from '../mappers/payment.mapper';

const DEFAULT_DATA_FILE = 'data/payments.json';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * JSON-backed adapter used until a real database is integrated.
 *
 * The whole file is loaded into memory on startup; every mutation is
 * serialized through a promise queue and persisted atomically (write to a
 * temporary file, then rename) so concurrent HTTP requests cannot corrupt the
 * file. This is still a single-process mock: it is NOT safe for multiple app
 * instances.
 */
@Injectable()
export class InMemoryPaymentRepository
  implements PaymentRepository, OnModuleInit
{
  private readonly logger = new Logger(InMemoryPaymentRepository.name);
  private readonly filePath: string;
  private rows: PaymentPersistenceModel[] = [];
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly configService: ConfigService) {
    const configuredPath =
      this.configService.get<string>('app.paymentsDataFile') ??
      DEFAULT_DATA_FILE;

    this.filePath = isAbsolute(configuredPath)
      ? configuredPath
      : resolve(process.cwd(), configuredPath);
  }

  async onModuleInit(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });

    try {
      const raw = await readFile(this.filePath, 'utf8');
      this.rows = this.parseRows(raw);
      this.logger.log(
        `Loaded ${this.rows.length} payment(s) from ${this.filePath}`,
      );
    } catch (error) {
      if (this.isFileNotFound(error)) {
        this.rows = [];
        await this.writeRows(this.rows);
        this.logger.log(`Created empty payments file at ${this.filePath}`);
        return;
      }

      throw error;
    }
  }

  async save(payment: Payment): Promise<void> {
    await this.enqueue(async () => {
      const row = PaymentMapper.toPersistence(payment);
      const duplicate = this.rows.some(
        (candidate) =>
          candidate.reference === row.reference && candidate.id !== row.id,
      );

      if (duplicate) {
        throw new PaymentReferenceAlreadyExistsError(row.reference);
      }

      const index = this.rows.findIndex((candidate) => candidate.id === row.id);
      const nextRows = [...this.rows];

      if (index === -1) {
        nextRows.push(row);
      } else {
        nextRows[index] = row;
      }

      await this.writeRows(nextRows);
      this.rows = nextRows;
    });
  }

  findById(id: PaymentId): Promise<Payment | null> {
    const row = this.rows.find((candidate) => candidate.id === id.toString());

    return Promise.resolve(row ? PaymentMapper.toDomain(row) : null);
  }

  findByReference(reference: string): Promise<Payment | null> {
    const row = this.rows.find(
      (candidate) => candidate.reference === reference,
    );

    return Promise.resolve(row ? PaymentMapper.toDomain(row) : null);
  }

  findAll(
    filters: PaymentFilters = {},
    pagination: Pagination = { page: DEFAULT_PAGE, limit: DEFAULT_LIMIT },
  ): Promise<PaginatedPayments> {
    const page = Math.max(DEFAULT_PAGE, Math.trunc(pagination.page));
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Math.trunc(pagination.limit)),
    );
    const currency = filters.currency?.toUpperCase();
    const status = filters.status ? String(filters.status) : undefined;

    const filtered = this.rows
      .filter((row) => {
        if (status && row.status !== status) {
          return false;
        }

        if (currency && row.currency !== currency) {
          return false;
        }

        if (filters.customerId && row.customerId !== filters.customerId) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const byDate = b.createdAt.localeCompare(a.createdAt);

        return byDate !== 0 ? byDate : b.id.localeCompare(a.id);
      });

    const offset = (page - 1) * limit;

    return Promise.resolve({
      items: filtered
        .slice(offset, offset + limit)
        .map((row) => PaymentMapper.toDomain(row)),
      total: filtered.length,
      page,
      limit,
    });
  }

  private parseRows(raw: string): PaymentPersistenceModel[] {
    // Windows editors frequently save JSON with a UTF-8 BOM; strip it before
    // parsing. An empty/whitespace-only file is treated as an empty collection.
    const normalized = raw.replace(/^\uFEFF/, '').trim();

    if (normalized.length === 0) {
      return [];
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(normalized) as unknown;
    } catch {
      throw new Error(`Payments file is not valid JSON: ${this.filePath}`);
    }

    if (!Array.isArray(parsed)) {
      throw new Error(
        `Payments file must contain a JSON array: ${this.filePath}`,
      );
    }

    const rows: unknown[] = parsed;

    return rows.map((row, index) => {
      if (!this.isPersistenceModel(row)) {
        throw new Error(
          `Invalid payment record at index ${index} in ${this.filePath}`,
        );
      }

      return row;
    });
  }

  private isPersistenceModel(value: unknown): value is PaymentPersistenceModel {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const row = value as Record<string, unknown>;

    return (
      typeof row.id === 'string' &&
      typeof row.reference === 'string' &&
      typeof row.customerId === 'string' &&
      typeof row.amount === 'number' &&
      typeof row.currency === 'string' &&
      typeof row.status === 'string' &&
      typeof row.createdAt === 'string' &&
      typeof row.updatedAt === 'string'
    );
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.writeQueue.then(task, task);
    this.writeQueue = result.then(
      () => undefined,
      () => undefined,
    );

    return result;
  }

  private async writeRows(rows: PaymentPersistenceModel[]): Promise<void> {
    const payload = `${JSON.stringify(rows, null, 2)}\n`;
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;

    await writeFile(temporaryPath, payload, 'utf8');
    await rename(temporaryPath, this.filePath);
  }

  private isFileNotFound(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    );
  }
}
