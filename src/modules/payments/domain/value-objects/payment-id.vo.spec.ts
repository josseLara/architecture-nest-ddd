import { PaymentId } from './payment-id.vo';
import { InvalidPaymentIdError } from '../errors/invalid-payment-id.error';

describe('PaymentId', () => {
  it('generates a valid UUID v4', () => {
    const id = PaymentId.create();

    expect(id.toString()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('normalizes a valid UUID to lowercase', () => {
    const id = PaymentId.fromString('3F2504E0-4F89-41D3-9A0C-0305E82C3301');

    expect(id.toString()).toBe('3f2504e0-4f89-41d3-9a0c-0305e82c3301');
    expect(id.equals(PaymentId.fromString(id.toString()))).toBe(true);
  });

  it.each([
    'not-a-uuid',
    '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
    '3f2504e0-4f89-41d3-1a0c-0305e82c3301',
    '',
  ])('rejects invalid id "%s"', (value) => {
    expect(() => PaymentId.fromString(value)).toThrow(InvalidPaymentIdError);
  });
});
