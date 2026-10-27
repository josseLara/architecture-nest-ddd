import { Payment, PaymentStatus } from './payment.entity';
import { InvalidPaymentError } from '../errors/invalid-payment.error';
import { InvalidPaymentStateTransitionError } from '../errors/invalid-payment-state-transition.error';
import { Money } from '../value-objects/money.vo';

const FIXED_DATE = new Date('2026-01-15T12:00:00.000Z');

function createPayment(): Payment {
  return Payment.create({
    reference: 'PAY-2026-0001',
    customerId: 'customer-123',
    money: Money.fromDecimal(150.75, 'USD'),
    description: 'Subscription payment',
    now: FIXED_DATE,
  });
}

describe('Payment', () => {
  it('creates a pending payment with normalized data', () => {
    const payment = Payment.create({
      reference: '  PAY-2026-0001  ',
      customerId: '  customer-123  ',
      money: Money.fromDecimal(150.75, 'usd'),
      description: '  Subscription payment  ',
      now: FIXED_DATE,
    });

    expect(payment.status).toBe(PaymentStatus.PENDING);
    expect(payment.reference).toBe('PAY-2026-0001');
    expect(payment.customerId).toBe('customer-123');
    expect(payment.description).toBe('Subscription payment');
    expect(payment.money.currency).toBe('USD');
    expect(payment.createdAt.toISOString()).toBe(FIXED_DATE.toISOString());
    expect(payment.approvedAt).toBeUndefined();
    expect(payment.rejectedAt).toBeUndefined();
  });

  it('rejects a zero amount', () => {
    expect(() =>
      Payment.create({
        reference: 'PAY-2026-0002',
        customerId: 'customer-123',
        money: Money.fromMinorUnits(0, 'USD'),
      }),
    ).toThrow(InvalidPaymentError);
  });

  it.each(['', 'AB', 'with spaces', 'a'.repeat(65)])(
    'rejects invalid reference "%s"',
    (reference) => {
      expect(() =>
        Payment.create({
          reference,
          customerId: 'customer-123',
          money: Money.fromDecimal(10, 'USD'),
        }),
      ).toThrow(InvalidPaymentError);
    },
  );

  it('approves a pending payment', () => {
    const payment = createPayment();
    const approvedAt = new Date('2026-01-15T12:05:00.000Z');

    payment.approve(approvedAt);

    expect(payment.status).toBe(PaymentStatus.APPROVED);
    expect(payment.approvedAt?.toISOString()).toBe(approvedAt.toISOString());
    expect(payment.updatedAt.toISOString()).toBe(approvedAt.toISOString());
  });

  it('cannot approve an already approved payment', () => {
    const payment = createPayment();
    payment.approve(FIXED_DATE);

    expect(() => payment.approve(FIXED_DATE)).toThrow(
      InvalidPaymentStateTransitionError,
    );
  });

  it('rejects a pending payment and stores the reason', () => {
    const payment = createPayment();
    const rejectedAt = new Date('2026-01-15T12:10:00.000Z');

    payment.reject('  suspected fraud  ', rejectedAt);

    expect(payment.status).toBe(PaymentStatus.REJECTED);
    expect(payment.rejectionReason).toBe('suspected fraud');
    expect(payment.rejectedAt?.toISOString()).toBe(rejectedAt.toISOString());
    expect(payment.approvedAt).toBeUndefined();
  });

  it('cannot reject an approved payment', () => {
    const payment = createPayment();
    payment.approve(FIXED_DATE);

    expect(() => payment.reject('suspected fraud')).toThrow(
      InvalidPaymentStateTransitionError,
    );
  });

  it.each(['', 'no'])('rejects an invalid rejection reason "%s"', (reason) => {
    expect(() => createPayment().reject(reason)).toThrow(InvalidPaymentError);
  });

  it('does not expose mutable internal dates', () => {
    const payment = createPayment();
    const createdAt = payment.createdAt;

    createdAt.setFullYear(1999);

    expect(payment.createdAt.getUTCFullYear()).toBe(2026);
  });
});
