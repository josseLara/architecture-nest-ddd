import { Global, Module } from '@nestjs/common';
import {
  PrometheusModule,
  makeCounterProvider,
} from '@willsoto/nestjs-prometheus';
import { MetricsService, PAYMENT_TRANSACTIONS_METRIC } from './metrics.service';

@Global()
@Module({
  imports: [
    PrometheusModule.register({
      defaultMetrics: { enabled: true },
      defaultLabels: { service: 'payments-api' },
    }),
  ],
  providers: [
    makeCounterProvider({
      name: PAYMENT_TRANSACTIONS_METRIC,
      help: 'Total number of payment transactions grouped by status and currency',
      labelNames: ['status', 'currency'],
    }),
    MetricsService,
  ],
  exports: [MetricsService],
})
export class MetricsModule {}
