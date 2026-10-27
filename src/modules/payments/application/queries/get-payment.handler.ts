import { Inject, Injectable } from '@nestjs/common';
import { Payment } from '../../domain/entities/payment.entity';
import {
  PAYMENT_REPOSITORY,
  type PaymentRepository,
} from '../../domain/repositories/payment.repository';
import { PaymentId } from '../../domain/value-objects/payment-id.vo';
import { PaymentNotFoundError } from '../errors/payment-not-found.error';
import { GetPaymentQuery } from './get-payment.query';

@Injectable()
export class GetPaymentHandler {
  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly payments: PaymentRepository,
  ) {}

  async execute(query: GetPaymentQuery): Promise<Payment> {
    const paymentId = PaymentId.fromString(query.paymentId);
    const payment = await this.payments.findById(paymentId);

    if (!payment) {
      throw new PaymentNotFoundError(query.paymentId);
    }

    return payment;
  }
}
