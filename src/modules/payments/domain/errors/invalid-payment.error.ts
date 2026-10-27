import { DomainError } from './domain.error';

export class InvalidPaymentError extends DomainError {
  readonly code = 'INVALID_PAYMENT';

  constructor(message: string) {
    super(message);
  }
}
