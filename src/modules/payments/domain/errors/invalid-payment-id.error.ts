import { DomainError } from './domain.error';

export class InvalidPaymentIdError extends DomainError {
  readonly code = 'INVALID_PAYMENT_ID';

  constructor(value: string) {
    super(`"${value}" is not a valid payment id (UUID v4 expected)`);
  }
}
