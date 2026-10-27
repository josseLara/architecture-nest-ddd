import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export interface SwaggerSetupOptions {
  apiPrefix: string;
}

/**
 * Mounts Swagger UI at `/{apiPrefix}/docs` and the raw OpenAPI document at
 * `/{apiPrefix}/docs-json`.
 *
 * Kept outside main.ts so the e2e suite can generate and assert the document
 * without bootstrapping a listening server.
 */
export function setupSwagger(
  app: INestApplication,
  options: SwaggerSetupOptions,
): void {
  const config = new DocumentBuilder()
    .setTitle('Payments API')
    .setDescription(
      [
        'API de pagos construida con NestJS, arquitectura hexagonal y DDD.',
        '',
        '**Flujo:** `pending` → `approved` | `rejected`.',
        '',
        '**Autenticación opcional:** si `API_KEY` está configurada, enviar el header `x-api-key`.',
      ].join('\n'),
    )
    .setVersion('1.0.0')
    .addTag('payments', 'Ciclo de vida de un pago')
    .addTag('health', 'Estado del servicio')
    .addTag('observability', 'Métricas de la aplicación')
    // Relative server: Swagger UI resolves it against the current origin, so
    // "Try it out" works locally and behind any domain/reverse proxy.
    .addServer('/', 'Servidor actual')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-api-key',
        in: 'header',
        description:
          'Opcional. Requerido únicamente si la variable API_KEY está definida.',
      },
      'api-key',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // The Prometheus controller belongs to @willsoto/nestjs-prometheus, so it
  // cannot be annotated with @ApiOperation. Document it explicitly.
  document.paths[`/${options.apiPrefix}/metrics`] = {
    get: {
      tags: ['observability'],
      summary: 'Métricas Prometheus',
      description:
        'Expone las métricas en formato de texto Prometheus, incluido payment_transactions_total.',
      security: [{ 'api-key': [] }],
      responses: {
        '200': {
          description: 'Métricas en formato Prometheus.',
          content: {
            'text/plain': {
              schema: { type: 'string' },
            },
          },
        },
        '401': {
          description:
            'x-api-key ausente o inválida. Solo aplica si API_KEY está configurada.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponseDto' },
            },
          },
        },
      },
    },
  };

  SwaggerModule.setup('docs', app, document, {
    useGlobalPrefix: true,
    customSiteTitle: 'Payments API · Swagger',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      tagsSorter: 'alpha',
      operationsSorter: 'method',
      docExpansion: 'list',
    },
  });
}
