import { DomainError } from './domain.error';

export class InvalidPaymentStateTransitionError extends DomainError {
  readonly code = 'INVALID_PAYMENT_STATE_TRANSITION';

  constructor(paymentId: string, currentStatus: string, action: string) {
    super(
      `Payment "${paymentId}" cannot be ${action} while its status is "${currentStatus}"`,
    );
  }
}
