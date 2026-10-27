import { PaymentFilters } from '../../domain/repositories/payment.repository';

export class ListPaymentsQuery {
  constructor(
    public readonly filters: PaymentFilters = {},
    public readonly page = 1,
    public readonly limit = 20,
  ) {}
}
