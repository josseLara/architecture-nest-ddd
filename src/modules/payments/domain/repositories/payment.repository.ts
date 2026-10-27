import { Payment, PaymentStatus } from '../entities/payment.entity';
import { PaymentId } from '../value-objects/payment-id.vo';

export const PAYMENT_REPOSITORY = Symbol('PAYMENT_REPOSITORY');

export interface PaymentFilters {
  status?: PaymentStatus;
  currency?: string;
  customerId?: string;
}

export interface Pagination {
  page: number;
  limit: number;
}

export interface PaginatedPayments {
  items: Payment[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Output port for payment persistence.
 *
 * The domain only knows this contract; any adapter (JSON file, PostgreSQL,
 * MongoDB...) can replace the current implementation without touching the
 * use cases.
 */
export interface PaymentRepository {
  /**
   * Inserts or updates a payment.
   *
   * Must reject with `PaymentReferenceAlreadyExistsError` when another payment
   * already owns the same reference. Real database adapters should back this
   * with a unique constraint.
   */
  save(payment: Payment): Promise<void>;

  findById(id: PaymentId): Promise<Payment | null>;

  findByReference(reference: string): Promise<Payment | null>;

  findAll(
    filters?: PaymentFilters,
    pagination?: Pagination,
  ): Promise<PaginatedPayments>;
}
