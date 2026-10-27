export const PAYMENT_METRICS = Symbol('PAYMENT_METRICS');

/**
 * Output port that isolates the use cases from the metrics implementation.
 *
 * The application layer does not import Prometheus: `MetricsService` is bound
 * to this token in the payments module.
 */
export interface PaymentMetrics {
  recordPaymentTransaction(status: string, currency: string): void;
}
