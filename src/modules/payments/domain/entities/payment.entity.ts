import { InvalidPaymentError } from '../errors/invalid-payment.error';
import { InvalidPaymentStateTransitionError } from '../errors/invalid-payment-state-transition.error';
import { Money } from '../value-objects/money.vo';
import { PaymentId } from '../value-objects/payment-id.vo';

export enum PaymentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return Object.values(PaymentStatus).includes(value as PaymentStatus);
}

const REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/;
const MAX_CUSTOMER_ID_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 255;
const MIN_REJECTION_REASON_LENGTH = 3;
const MAX_REJECTION_REASON_LENGTH = 255;

export interface CreatePaymentProps {
  reference: string;
  customerId: string;
  money: Money;
  description?: string;
  now?: Date;
}

export interface RehydratePaymentProps {
  id: PaymentId;
  reference: string;
  customerId: string;
  money: Money;
  description?: string;
  status: PaymentStatus;
  createdAt: Date;
  updatedAt: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
}

/**
 * Payment aggregate root.
 *
 * All state transitions are guarded here: an invalid transition is impossible
 * to represent through the public API, regardless of which adapter calls it.
 */
export class Payment {
  private constructor(private readonly props: RehydratePaymentProps) {}

  static create(input: CreatePaymentProps): Payment {
    const now = Payment.cloneDate(input.now ?? new Date());

    if (!(input.money instanceof Money) || !input.money.isPositive()) {
      throw new InvalidPaymentError(
        'A payment amount must be greater than zero',
      );
    }

    return new Payment({
      id: PaymentId.create(),
      reference: Payment.normalizeReference(input.reference),
      customerId: Payment.normalizeCustomerId(input.customerId),
      money: input.money,
      description: Payment.normalizeDescription(input.description),
      status: PaymentStatus.PENDING,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Rebuilds an aggregate from trusted persistence data while re-validating
   * every invariant. Never bypasses the domain rules.
   */
  static rehydrate(props: RehydratePaymentProps): Payment {
    if (!(props.id instanceof PaymentId)) {
      throw new InvalidPaymentError('Payment id is required');
    }

    if (!isPaymentStatus(props.status)) {
      throw new InvalidPaymentError(
        `"${String(props.status)}" is not a valid payment status`,
      );
    }

    if (!(props.money instanceof Money) || !props.money.isPositive()) {
      throw new InvalidPaymentError(
        'A payment amount must be greater than zero',
      );
    }

    Payment.assertReference(props.reference);
    Payment.assertCustomerId(props.customerId);
    Payment.assertDescription(props.description);
    Payment.assertValidDate(props.createdAt, 'createdAt');
    Payment.assertValidDate(props.updatedAt, 'updatedAt');

    if (props.approvedAt) {
      Payment.assertValidDate(props.approvedAt, 'approvedAt');
    }

    if (props.rejectedAt) {
      Payment.assertValidDate(props.rejectedAt, 'rejectedAt');
    }

    if (props.rejectionReason !== undefined) {
      Payment.assertRejectionReason(props.rejectionReason);
    }

    const payment = new Payment({
      ...props,
      createdAt: Payment.cloneDate(props.createdAt),
      updatedAt: Payment.cloneDate(props.updatedAt),
      approvedAt: props.approvedAt
        ? Payment.cloneDate(props.approvedAt)
        : undefined,
      rejectedAt: props.rejectedAt
        ? Payment.cloneDate(props.rejectedAt)
        : undefined,
    });

    payment.assertInvariants();

    return payment;
  }

  get id(): PaymentId {
    return this.props.id;
  }

  get reference(): string {
    return this.props.reference;
  }

  get customerId(): string {
    return this.props.customerId;
  }

  get money(): Money {
    return this.props.money;
  }

  get description(): string | undefined {
    return this.props.description;
  }

  get status(): PaymentStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return Payment.cloneDate(this.props.createdAt);
  }

  get updatedAt(): Date {
    return Payment.cloneDate(this.props.updatedAt);
  }

  get approvedAt(): Date | undefined {
    return this.props.approvedAt
      ? Payment.cloneDate(this.props.approvedAt)
      : undefined;
  }

  get rejectedAt(): Date | undefined {
    return this.props.rejectedAt
      ? Payment.cloneDate(this.props.rejectedAt)
      : undefined;
  }

  get rejectionReason(): string | undefined {
    return this.props.rejectionReason;
  }

  isPending(): boolean {
    return this.props.status === PaymentStatus.PENDING;
  }

  isApproved(): boolean {
    return this.props.status === PaymentStatus.APPROVED;
  }

  isRejected(): boolean {
    return this.props.status === PaymentStatus.REJECTED;
  }

  approve(at: Date = new Date()): void {
    this.assertPending('approved');
    Payment.assertValidDate(at, 'approvedAt');

    this.props.status = PaymentStatus.APPROVED;
    this.props.approvedAt = Payment.cloneDate(at);
    this.props.updatedAt = Payment.cloneDate(at);
  }

  reject(reason: string, at: Date = new Date()): void {
    this.assertPending('rejected');
    Payment.assertRejectionReason(reason);
    Payment.assertValidDate(at, 'rejectedAt');

    this.props.status = PaymentStatus.REJECTED;
    this.props.rejectionReason = reason.trim();
    this.props.rejectedAt = Payment.cloneDate(at);
    this.props.updatedAt = Payment.cloneDate(at);
  }

  private assertPending(action: string): void {
    if (this.props.status !== PaymentStatus.PENDING) {
      throw new InvalidPaymentStateTransitionError(
        this.props.id.toString(),
        this.props.status,
        action,
      );
    }
  }

  private assertInvariants(): void {
    if (this.props.updatedAt.getTime() < this.props.createdAt.getTime()) {
      throw new InvalidPaymentError(
        'updatedAt cannot be earlier than createdAt',
      );
    }

    switch (this.props.status) {
      case PaymentStatus.PENDING:
        if (
          this.props.approvedAt ||
          this.props.rejectedAt ||
          this.props.rejectionReason
        ) {
          throw new InvalidPaymentError(
            'A pending payment cannot have approval or rejection data',
          );
        }
        break;

      case PaymentStatus.APPROVED:
        if (!this.props.approvedAt) {
          throw new InvalidPaymentError(
            'An approved payment must have an approvedAt date',
          );
        }

        if (this.props.rejectedAt || this.props.rejectionReason) {
          throw new InvalidPaymentError(
            'An approved payment cannot have rejection data',
          );
        }

        if (this.props.approvedAt.getTime() > this.props.updatedAt.getTime()) {
          throw new InvalidPaymentError(
            'approvedAt cannot be later than updatedAt',
          );
        }
        break;

      case PaymentStatus.REJECTED:
        if (!this.props.rejectedAt || !this.props.rejectionReason) {
          throw new InvalidPaymentError(
            'A rejected payment must have a rejection date and reason',
          );
        }

        if (this.props.approvedAt) {
          throw new InvalidPaymentError(
            'A rejected payment cannot have approval data',
          );
        }

        if (this.props.rejectedAt.getTime() > this.props.updatedAt.getTime()) {
          throw new InvalidPaymentError(
            'rejectedAt cannot be later than updatedAt',
          );
        }
        break;

      default:
        throw new InvalidPaymentError('Unsupported payment status');
    }
  }

  private static normalizeReference(reference: string): string {
    if (typeof reference !== 'string') {
      throw new InvalidPaymentError('Reference must be a string');
    }

    const normalized = reference.trim();
    Payment.assertReference(normalized);

    return normalized;
  }

  private static assertReference(reference: string): void {
    if (typeof reference !== 'string' || !REFERENCE_PATTERN.test(reference)) {
      throw new InvalidPaymentError(
        'Reference must be 3-64 characters and contain only letters, numbers, hyphens or underscores',
      );
    }
  }

  private static normalizeCustomerId(customerId: string): string {
    if (typeof customerId !== 'string') {
      throw new InvalidPaymentError('Customer id must be a string');
    }

    const normalized = customerId.trim();
    Payment.assertCustomerId(normalized);

    return normalized;
  }

  private static assertCustomerId(customerId: string): void {
    if (
      typeof customerId !== 'string' ||
      customerId.length === 0 ||
      customerId.length > MAX_CUSTOMER_ID_LENGTH
    ) {
      throw new InvalidPaymentError(
        `Customer id must be between 1 and ${MAX_CUSTOMER_ID_LENGTH} characters`,
      );
    }
  }

  private static normalizeDescription(
    description?: string,
  ): string | undefined {
    if (description === undefined) {
      return undefined;
    }

    const normalized = description.trim();
    Payment.assertDescription(normalized);

    return normalized.length === 0 ? undefined : normalized;
  }

  private static assertDescription(description?: string): void {
    if (
      description !== undefined &&
      description.length > MAX_DESCRIPTION_LENGTH
    ) {
      throw new InvalidPaymentError(
        `Description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters`,
      );
    }
  }

  private static assertRejectionReason(reason: string): void {
    if (typeof reason !== 'string') {
      throw new InvalidPaymentError('Rejection reason must be a string');
    }

    const normalized = reason.trim();

    if (
      normalized.length < MIN_REJECTION_REASON_LENGTH ||
      normalized.length > MAX_REJECTION_REASON_LENGTH
    ) {
      throw new InvalidPaymentError(
        `Rejection reason must be between ${MIN_REJECTION_REASON_LENGTH} and ${MAX_REJECTION_REASON_LENGTH} characters`,
      );
    }
  }

  private static assertValidDate(date: Date, field: string): void {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      throw new InvalidPaymentError(`${field} must be a valid date`);
    }
  }

  private static cloneDate(date: Date): Date {
    return new Date(date.getTime());
  }
}
