import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ApiKeyGuard } from './common/guards/api-key.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import configuration from './config/configuration';
import { MetricsModule } from './metrics/metrics.module';
import { PaymentsModule } from './modules/payments/payments.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      load: [configuration],
      envFilePath: [
        '.env.local',
        `.env.${process.env.NODE_ENV ?? 'development'}`,
        '.env',
      ],
    }),
    MetricsModule,
    PaymentsModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
