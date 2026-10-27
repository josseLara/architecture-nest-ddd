import { randomUUID } from 'node:crypto';
import { InvalidPaymentIdError } from '../errors/invalid-payment-id.error';

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Strongly typed payment identifier.
 *
 * Using a value object (instead of a raw string) prevents mixing identifiers
 * with references, customer ids or any other string in the domain API.
 */
export class PaymentId {
  private constructor(private readonly value: string) {}

  static create(): PaymentId {
    return new PaymentId(randomUUID());
  }

  static fromString(value: string): PaymentId {
    if (typeof value !== 'string') {
      throw new InvalidPaymentIdError(String(value));
    }

    const normalized = value.trim().toLowerCase();

    if (!UUID_V4_PATTERN.test(normalized)) {
      throw new InvalidPaymentIdError(value);
    }

    return new PaymentId(normalized);
  }

  toString(): string {
    return this.value;
  }

  equals(other: PaymentId): boolean {
    return this.value === other.value;
  }
}
