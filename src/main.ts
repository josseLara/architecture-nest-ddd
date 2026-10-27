import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfiguration } from './config/configuration';
import { setupSwagger } from './config/swagger.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const config = configService.getOrThrow<AppConfiguration>('app');

  app.setGlobalPrefix(config.apiPrefix);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      validationError: { target: false, value: false },
    }),
  );

  const allowAnyOrigin =
    config.corsOrigins.length === 0 || config.corsOrigins.includes('*');

  app.enableCors({
    origin: allowAnyOrigin ? true : config.corsOrigins,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    credentials: true,
  });

  app.enableShutdownHooks();

  setupSwagger(app, {
    apiPrefix: config.apiPrefix,
  });

  await app.listen(config.port, '0.0.0.0');

  const url = await app.getUrl();
  Logger.log(
    `Payments API listening on ${url}/${config.apiPrefix}`,
    'Bootstrap',
  );
  Logger.log(
    `Swagger UI available at ${url}/${config.apiPrefix}/docs`,
    'Bootstrap',
  );
}

bootstrap().catch((error: unknown) => {
  Logger.error(
    'Failed to start the application',
    error instanceof Error ? error.stack : String(error),
    'Bootstrap',
  );
  process.exitCode = 1;
});
