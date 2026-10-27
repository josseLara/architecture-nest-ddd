import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { setupSwagger } from './../src/config/swagger.config';

const DATA_FILE = join(process.cwd(), 'data', 'payments.e2e.json');
const RUN_ID = `${Date.now()}`;

interface PaymentBody {
  id: string;
  reference: string;
  customerId: string;
  amount: number;
  currency: string;
  status: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string | string[];
}

interface PaginatedBody {
  data: PaymentBody[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface OpenApiDocument {
  paths: Record<string, unknown>;
  components?: {
    schemas?: Record<string, unknown>;
  };
}

describe('Payments API (e2e)', () => {
  let app: INestApplication<App>;
  let httpServer: App;
  let approvedPaymentId: string;

  beforeAll(async () => {
    process.env.PAYMENTS_DATA_FILE = DATA_FILE;
    await rm(DATA_FILE, { force: true });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
      }),
    );

    setupSwagger(app, { apiPrefix: 'api' });

    await app.init();
    httpServer = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
    await rm(DATA_FILE, { force: true });
  });

  it('exposes a public health endpoint', async () => {
    const response = await request(httpServer).get('/api/health').expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'payments-api',
    });
  });

  it('serves Swagger UI and a complete OpenAPI document', async () => {
    const ui = await request(httpServer).get('/api/docs').expect(200);
    expect(ui.text).toContain('swagger-ui');

    const response = await request(httpServer)
      .get('/api/docs-json')
      .expect(200);
    const document = response.body as OpenApiDocument;

    expect(document.paths['/api/payments']).toBeDefined();
    expect(document.paths['/api/payments/{id}']).toBeDefined();
    expect(document.paths['/api/payments/{id}/approve']).toBeDefined();
    expect(document.paths['/api/payments/{id}/reject']).toBeDefined();
    expect(document.paths['/api/health']).toBeDefined();
    expect(document.paths['/api/metrics']).toBeDefined();

    expect(document.components?.schemas?.CreatePaymentDto).toBeDefined();
    expect(document.components?.schemas?.RejectPaymentDto).toBeDefined();
    expect(document.components?.schemas?.PaymentResponseDto).toBeDefined();
    expect(document.components?.schemas?.ErrorResponseDto).toBeDefined();
  });

  it('creates a pending payment', async () => {
    const response = await request(httpServer)
      .post('/api/payments')
      .send({
        reference: `e2e-${RUN_ID}-approved`,
        customerId: 'customer-001',
        amount: 150.75,
        currency: 'usd',
        description: 'E2E approved payment',
      })
      .expect(201);

    const body = response.body as PaymentBody;
    approvedPaymentId = body.id;
    expect(response.body).toMatchObject({
      reference: `e2e-${RUN_ID}-approved`,
      customerId: 'customer-001',
      amount: 150.75,
      currency: 'USD',
      status: 'pending',
      description: 'E2E approved payment',
    });
    expect(body.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(body.createdAt).toBeDefined();
  });

  it('rejects a duplicated reference with 409', async () => {
    const response = await request(httpServer)
      .post('/api/payments')
      .send({
        reference: `e2e-${RUN_ID}-approved`,
        customerId: 'customer-999',
        amount: 10,
        currency: 'USD',
      })
      .expect(409);

    expect(response.body).toMatchObject({
      statusCode: 409,
      code: 'PAYMENT_REFERENCE_ALREADY_EXISTS',
    });
  });

  it('returns a payment by id', async () => {
    const response = await request(httpServer)
      .get(`/api/payments/${approvedPaymentId}`)
      .expect(200);

    const body = response.body as PaymentBody;
    expect(body.id).toBe(approvedPaymentId);
    expect(body.status).toBe('pending');
  });

  it('approves a pending payment', async () => {
    const response = await request(httpServer)
      .post(`/api/payments/${approvedPaymentId}/approve`)
      .expect(200);

    const body = response.body as PaymentBody;
    expect(body.status).toBe('approved');
    expect(body.approvedAt).toBeDefined();
  });

  it('rejects an invalid state transition with 409', async () => {
    const response = await request(httpServer)
      .post(`/api/payments/${approvedPaymentId}/approve`)
      .expect(409);

    expect(response.body).toMatchObject({
      code: 'INVALID_PAYMENT_STATE_TRANSITION',
    });
  });

  it('rejects a pending payment and stores the reason', async () => {
    const created = await request(httpServer)
      .post('/api/payments')
      .send({
        reference: `e2e-${RUN_ID}-rejected`,
        customerId: 'customer-002',
        amount: 99.99,
        currency: 'EUR',
      })
      .expect(201);

    const createdBody = created.body as PaymentBody;

    const response = await request(httpServer)
      .post(`/api/payments/${createdBody.id}/reject`)
      .send({ reason: 'Suspected fraud' })
      .expect(200);

    const body = response.body as PaymentBody;
    expect(response.body).toMatchObject({
      status: 'rejected',
      rejectionReason: 'Suspected fraud',
    });
    expect(body.rejectedAt).toBeDefined();
  });

  it('validates the request body', async () => {
    const response = await request(httpServer)
      .post('/api/payments')
      .send({
        reference: `e2e-${RUN_ID}-invalid`,
        customerId: 'customer-003',
        amount: 10.999,
        currency: 'US',
        unsupported: true,
      })
      .expect(400);

    const body = response.body as ApiErrorBody;
    expect(response.body).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
    expect(body.message).toEqual(expect.any(Array));
  });

  it('requires a rejection reason', async () => {
    const response = await request(httpServer)
      .post(`/api/payments/${approvedPaymentId}/reject`)
      .send({})
      .expect(400);

    const body = response.body as ApiErrorBody;
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 for an unknown payment', async () => {
    const response = await request(httpServer)
      .get(`/api/payments/${randomUUID()}`)
      .expect(404);

    expect(response.body).toMatchObject({
      statusCode: 404,
      code: 'PAYMENT_NOT_FOUND',
    });
  });

  it('returns 400 for a malformed payment id', async () => {
    await request(httpServer).get('/api/payments/not-a-uuid').expect(400);
  });

  it('lists payments with filters and pagination metadata', async () => {
    const response = await request(httpServer)
      .get('/api/payments?status=approved&currency=USD&page=1&limit=10')
      .expect(200);

    const body = response.body as PaginatedBody;
    expect(body.meta).toMatchObject({
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      id: approvedPaymentId,
      status: 'approved',
      currency: 'USD',
    });
  });

  it('persists amounts in minor units in the JSON file', async () => {
    const raw = await readFile(DATA_FILE, 'utf8');
    const rows = JSON.parse(raw) as Array<{ id: string; amount: number }>;
    const stored = rows.find((row) => row.id === approvedPaymentId);

    expect(stored?.amount).toBe(15075);
  });

  it('exposes Prometheus metrics with status and currency labels', async () => {
    const response = await request(httpServer).get('/api/metrics').expect(200);

    expect(response.text).toContain('payment_transactions_total');
    expect(response.text).toContain('currency="USD"');
    expect(response.text).toContain('status="approved"');
    expect(response.text).toContain('status="rejected"');
  });
});
