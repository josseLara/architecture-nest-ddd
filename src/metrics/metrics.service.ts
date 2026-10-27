import { Injectable, Logger } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';

export const PAYMENT_TRANSACTIONS_METRIC = 'payment_transactions_total';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(
    @InjectMetric(PAYMENT_TRANSACTIONS_METRIC)
    private readonly paymentTransactions: Counter<string>,
  ) {}

  /**
   * Increments `payment_transactions_total{status,currency}`.
   * Called by the payment use cases after a successful state change.
   *
   * Metrics are observability data: a metrics failure must never roll back or
   * fail an already persisted payment.
   */
  recordPaymentTransaction(status: string, currency: string): void {
    try {
      this.paymentTransactions.inc({ status, currency });
    } catch (error) {
      this.logger.warn(
        `Could not record payment metric: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
