import { ApplicationError } from './application.error';

export class PaymentNotFoundError extends ApplicationError {
  readonly code = 'PAYMENT_NOT_FOUND';

  constructor(paymentId: string) {
    super(`Payment "${paymentId}" was not found`);
  }
}
