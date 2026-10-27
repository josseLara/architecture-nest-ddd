import { Inject, Injectable } from '@nestjs/common';
import { Payment } from '../../domain/entities/payment.entity';
import {
  PAYMENT_REPOSITORY,
  type PaymentRepository,
} from '../../domain/repositories/payment.repository';
import { PaymentId } from '../../domain/value-objects/payment-id.vo';
import { PaymentNotFoundError } from '../errors/payment-not-found.error';
import {
  PAYMENT_METRICS,
  type PaymentMetrics,
} from '../ports/payment-metrics.port';
import { RejectPaymentCommand } from './reject-payment.command';

@Injectable()
export class RejectPaymentHandler {
  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly payments: PaymentRepository,
    @Inject(PAYMENT_METRICS)
    private readonly metrics: PaymentMetrics,
  ) {}

  async execute(command: RejectPaymentCommand): Promise<Payment> {
    const paymentId = PaymentId.fromString(command.paymentId);
    const payment = await this.payments.findById(paymentId);

    if (!payment) {
      throw new PaymentNotFoundError(command.paymentId);
    }

    payment.reject(command.reason);
    await this.payments.save(payment);

    this.metrics.recordPaymentTransaction(
      payment.status,
      payment.money.currency,
    );

    return payment;
  }
}
