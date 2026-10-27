import {
  Payment,
  PaymentStatus,
  isPaymentStatus,
} from '../../domain/entities/payment.entity';
import { InvalidPaymentError } from '../../domain/errors/invalid-payment.error';
import { Money } from '../../domain/value-objects/money.vo';
import { PaymentId } from '../../domain/value-objects/payment-id.vo';

/**
 * Flat representation stored in `data/payments.json`.
 *
 * `amount` is expressed in minor units (e.g. cents) as an integer. Mapping is
 * deliberately explicit so a future SQL/NoSQL adapter can reuse the same
 * anti-corruption layer.
 */
export interface PaymentPersistenceModel {
  id: string;
  reference: string;
  customerId: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
}

export class PaymentMapper {
  static toDomain(row: PaymentPersistenceModel): Payment {
    return Payment.rehydrate({
      id: PaymentId.fromString(row.id),
      reference: row.reference,
      customerId: row.customerId,
      money: Money.fromMinorUnits(row.amount, row.currency),
      description: row.description ?? undefined,
      status: PaymentMapper.parseStatus(row.status),
      createdAt: PaymentMapper.parseRequiredDate(row.createdAt, 'createdAt'),
      updatedAt: PaymentMapper.parseRequiredDate(row.updatedAt, 'updatedAt'),
      approvedAt: PaymentMapper.parseOptionalDate(row.approvedAt, 'approvedAt'),
      rejectedAt: PaymentMapper.parseOptionalDate(row.rejectedAt, 'rejectedAt'),
      rejectionReason: row.rejectionReason ?? undefined,
    });
  }

  static toPersistence(payment: Payment): PaymentPersistenceModel {
    return {
      id: payment.id.toString(),
      reference: payment.reference,
      customerId: payment.customerId,
      amount: payment.money.minorUnits,
      currency: payment.money.currency,
      status: payment.status,
      description: payment.description ?? null,
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
      approvedAt: payment.approvedAt?.toISOString() ?? null,
      rejectedAt: payment.rejectedAt?.toISOString() ?? null,
      rejectionReason: payment.rejectionReason ?? null,
    };
  }

  private static parseStatus(value: string): PaymentStatus {
    if (!isPaymentStatus(value)) {
      throw new InvalidPaymentError(
        `"${String(value)}" is not a valid payment status in persistence`,
      );
    }

    return value;
  }

  private static parseRequiredDate(value: string, field: string): Date {
    if (typeof value !== 'string') {
      throw new InvalidPaymentError(`Invalid ${field} in persistence`);
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new InvalidPaymentError(`Invalid ${field} in persistence`);
    }

    return date;
  }

  private static parseOptionalDate(
    value: string | null,
    field: string,
  ): Date | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }

    return PaymentMapper.parseRequiredDate(value, field);
  }
}
