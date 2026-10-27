import { Module } from '@nestjs/common';
import { MetricsModule } from '../../metrics/metrics.module';
import { MetricsService } from '../../metrics/metrics.service';
import { ApprovePaymentHandler } from './application/commands/approve-payment.handler';
import { CreatePaymentHandler } from './application/commands/create-payment.handler';
import { RejectPaymentHandler } from './application/commands/reject-payment.handler';
import { PAYMENT_METRICS } from './application/ports/payment-metrics.port';
import { GetPaymentHandler } from './application/queries/get-payment.handler';
import { ListPaymentsHandler } from './application/queries/list-payments.handler';
import { PAYMENT_REPOSITORY } from './domain/repositories/payment.repository';
import { PaymentsController } from './infrastructure/controllers/payments.controller';
import { InMemoryPaymentRepository } from './infrastructure/persistence/in-memory-payment.repository';

@Module({
  imports: [MetricsModule],
  controllers: [PaymentsController],
  providers: [
    CreatePaymentHandler,
    ApprovePaymentHandler,
    RejectPaymentHandler,
    GetPaymentHandler,
    ListPaymentsHandler,
    {
      provide: PAYMENT_REPOSITORY,
      useClass: InMemoryPaymentRepository,
    },
    {
      provide: PAYMENT_METRICS,
      useExisting: MetricsService,
    },
  ],
})
export class PaymentsModule {}
