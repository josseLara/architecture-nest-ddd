import { Inject, Injectable } from '@nestjs/common';
import {
  PAYMENT_REPOSITORY,
  type PaginatedPayments,
  type PaymentRepository,
} from '../../domain/repositories/payment.repository';
import { ListPaymentsQuery } from './list-payments.query';

@Injectable()
export class ListPaymentsHandler {
  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly payments: PaymentRepository,
  ) {}

  async execute(query: ListPaymentsQuery): Promise<PaginatedPayments> {
    return this.payments.findAll(query.filters, {
      page: query.page,
      limit: query.limit,
    });
  }
}
