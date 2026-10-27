import type { ConfigService } from '@nestjs/config';
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { InMemoryPaymentRepository } from './in-memory-payment.repository';

describe('InMemoryPaymentRepository', () => {
  let sequence = 0;
  const filesToClean: string[] = [];

  const nextFile = (): string => {
    const filePath = join(
      process.cwd(),
      'data',
      `payments.repository-spec-${process.pid}-${sequence++}.json`,
    );
    filesToClean.push(filePath);

    return filePath;
  };

  const createRepository = (filePath: string): InMemoryPaymentRepository => {
    const configService = {
      get: () => filePath,
    } as unknown as ConfigService;

    return new InMemoryPaymentRepository(configService);
  };

  afterEach(async () => {
    await Promise.all(
      filesToClean.splice(0).map((filePath) => rm(filePath, { force: true })),
    );
  });

  it('loads a JSON file saved with a UTF-8 BOM', async () => {
    const filePath = nextFile();
    await writeFile(filePath, '\uFEFF[]\n', 'utf8');

    const repository = createRepository(filePath);
    await repository.onModuleInit();

    await expect(repository.findAll()).resolves.toMatchObject({
      items: [],
      total: 0,
    });
  });

  it('treats an empty file as an empty collection', async () => {
    const filePath = nextFile();
    await writeFile(filePath, '\uFEFF', 'utf8');

    const repository = createRepository(filePath);
    await repository.onModuleInit();

    await expect(repository.findAll()).resolves.toMatchObject({
      items: [],
      total: 0,
    });
  });

  it('creates the data file when it does not exist', async () => {
    const filePath = nextFile();
    const repository = createRepository(filePath);

    await repository.onModuleInit();

    await expect(repository.findAll()).resolves.toMatchObject({
      items: [],
      total: 0,
    });
  });
});
