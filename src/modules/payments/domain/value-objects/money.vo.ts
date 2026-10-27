import { InvalidMoneyError } from '../errors/invalid-money.error';

const ISO_4217_PATTERN = /^[A-Z]{3}$/;
const MINOR_UNITS_PER_UNIT = 100;

/**
 * Money value object.
 *
 * Amounts are stored as integer minor units (e.g. cents) to avoid the
 * rounding errors of IEEE-754 floating point arithmetic. The public API
 * accepts decimal amounts and converts them once, at the boundary.
 */
export class Money {
  private constructor(
    private readonly amountInMinorUnits: number,
    private readonly currencyCode: string,
  ) {}

  /**
   * @param amountInMinorUnits integer amount in the currency's minor unit
   * @param currency ISO 4217 alphabetic code (e.g. "USD", "EUR", "ARS")
   */
  static fromMinorUnits(amountInMinorUnits: number, currency: string): Money {
    if (!Number.isSafeInteger(amountInMinorUnits)) {
      throw new InvalidMoneyError(
        'Amount must be an integer number of minor units',
      );
    }

    if (amountInMinorUnits < 0) {
      throw new InvalidMoneyError('Amount cannot be negative');
    }

    return new Money(amountInMinorUnits, Money.normalizeCurrency(currency));
  }

  /**
   * Builds Money from a decimal amount such as `150.75`.
   * More than two decimals is rejected instead of silently rounded.
   */
  static fromDecimal(amount: number, currency: string): Money {
    if (!Number.isFinite(amount)) {
      throw new InvalidMoneyError('Amount must be a finite number');
    }

    if (amount < 0) {
      throw new InvalidMoneyError('Amount cannot be negative');
    }

    const amountInMinorUnits = Math.round(amount * MINOR_UNITS_PER_UNIT);
    const roundingError = Math.abs(
      amount * MINOR_UNITS_PER_UNIT - amountInMinorUnits,
    );

    if (roundingError > 1e-6) {
      throw new InvalidMoneyError(
        'Amount cannot have more than two decimal places',
      );
    }

    return Money.fromMinorUnits(amountInMinorUnits, currency);
  }

  private static normalizeCurrency(currency: string): string {
    if (typeof currency !== 'string') {
      throw new InvalidMoneyError('Currency must be a string');
    }

    const normalized = currency.trim().toUpperCase();

    if (!ISO_4217_PATTERN.test(normalized)) {
      throw new InvalidMoneyError(
        `"${currency}" is not a valid ISO 4217 currency code`,
      );
    }

    return normalized;
  }

  get currency(): string {
    return this.currencyCode;
  }

  get minorUnits(): number {
    return this.amountInMinorUnits;
  }

  isZero(): boolean {
    return this.amountInMinorUnits === 0;
  }

  isPositive(): boolean {
    return this.amountInMinorUnits > 0;
  }

  equals(other: Money): boolean {
    return (
      this.amountInMinorUnits === other.amountInMinorUnits &&
      this.currencyCode === other.currencyCode
    );
  }

  add(other: Money): Money {
    this.assertSameCurrency(other, 'add');

    return Money.fromMinorUnits(
      this.amountInMinorUnits + other.amountInMinorUnits,
      this.currencyCode,
    );
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other, 'subtract');

    const result = this.amountInMinorUnits - other.amountInMinorUnits;

    if (result < 0) {
      throw new InvalidMoneyError(
        'Subtraction would produce a negative amount',
      );
    }

    return Money.fromMinorUnits(result, this.currencyCode);
  }

  toDecimal(): number {
    return this.amountInMinorUnits / MINOR_UNITS_PER_UNIT;
  }

  toString(): string {
    return `${this.toDecimal().toFixed(2)} ${this.currencyCode}`;
  }

  toJSON(): { amount: number; currency: string } {
    return {
      amount: this.toDecimal(),
      currency: this.currencyCode,
    };
  }

  private assertSameCurrency(other: Money, operation: string): void {
    if (this.currencyCode !== other.currencyCode) {
      throw new InvalidMoneyError(
        `Cannot ${operation} ${this.currencyCode} and ${other.currencyCode}`,
      );
    }
  }
}
