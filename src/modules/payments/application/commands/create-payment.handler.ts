import { Inject, Injectable } from '@nestjs/common';
import { Payment } from '../../domain/entities/payment.entity';
import {
  PAYMENT_REPOSITORY,
  type PaymentRepository,
} from '../../domain/repositories/payment.repository';
import { Money } from '../../domain/value-objects/money.vo';
import {
  PAYMENT_METRICS,
  type PaymentMetrics,
} from '../ports/payment-metrics.port';
import { CreatePaymentCommand } from './create-payment.command';

@Injectable()
export class CreatePaymentHandler {
  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly payments: PaymentRepository,
    @Inject(PAYMENT_METRICS)
    private readonly metrics: PaymentMetrics,
  ) {}

  async execute(command: CreatePaymentCommand): Promise<Payment> {
    const payment = Payment.create({
      reference: command.reference,
      customerId: command.customerId,
      money: Money.fromDecimal(command.amount, command.currency),
      description: command.description,
    });

    await this.payments.save(payment);

    this.metrics.recordPaymentTransaction(
      payment.status,
      payment.money.currency,
    );

    return payment;
  }
}
