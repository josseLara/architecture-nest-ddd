import { DomainError } from './domain.error';

export class PaymentReferenceAlreadyExistsError extends DomainError {
  readonly code = 'PAYMENT_REFERENCE_ALREADY_EXISTS';

  constructor(reference: string) {
    super(`A payment with reference "${reference}" already exists`);
  }
}
