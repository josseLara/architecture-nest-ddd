import { Money } from './money.vo';
import { InvalidMoneyError } from '../errors/invalid-money.error';

describe('Money', () => {
  it('creates money from a decimal amount using minor units', () => {
    const money = Money.fromDecimal(150.75, 'usd');

    expect(money.minorUnits).toBe(15075);
    expect(money.currency).toBe('USD');
    expect(money.toDecimal()).toBe(150.75);
    expect(money.toString()).toBe('150.75 USD');
  });

  it('creates money from integer minor units', () => {
    const money = Money.fromMinorUnits(999, 'EUR');

    expect(money.toDecimal()).toBe(9.99);
    expect(money.isPositive()).toBe(true);
    expect(money.isZero()).toBe(false);
  });

  it.each([10.999, 0.001, 1.005])(
    'rejects %p because it has more than two decimals',
    (amount) => {
      expect(() => Money.fromDecimal(amount, 'USD')).toThrow(InvalidMoneyError);
    },
  );

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid decimal amount %p',
    (amount) => {
      expect(() => Money.fromDecimal(amount, 'USD')).toThrow(InvalidMoneyError);
    },
  );

  it('rejects fractional minor units and negative values', () => {
    expect(() => Money.fromMinorUnits(10.5, 'USD')).toThrow(InvalidMoneyError);
    expect(() => Money.fromMinorUnits(-1, 'USD')).toThrow(InvalidMoneyError);
  });

  it.each(['US', 'USDD', '12A', ''])(
    'rejects invalid currency code "%s"',
    (currency) => {
      expect(() => Money.fromDecimal(10, currency)).toThrow(InvalidMoneyError);
    },
  );

  it('adds and subtracts money in the same currency', () => {
    const ten = Money.fromDecimal(10, 'USD');
    const five = Money.fromDecimal(5.5, 'USD');

    expect(ten.add(five).toDecimal()).toBe(15.5);
    expect(ten.subtract(five).toDecimal()).toBe(4.5);
  });

  it('rejects operations across different currencies', () => {
    const usd = Money.fromDecimal(10, 'USD');
    const eur = Money.fromDecimal(10, 'EUR');

    expect(() => usd.add(eur)).toThrow(InvalidMoneyError);
    expect(() => usd.subtract(eur)).toThrow(InvalidMoneyError);
  });

  it('rejects a subtraction that would produce a negative amount', () => {
    expect(() =>
      Money.fromDecimal(1, 'USD').subtract(Money.fromDecimal(2, 'USD')),
    ).toThrow(InvalidMoneyError);
  });

  it('compares by amount and currency', () => {
    expect(
      Money.fromDecimal(10, 'USD').equals(Money.fromDecimal(10, 'usd')),
    ).toBe(true);
    expect(
      Money.fromDecimal(10, 'USD').equals(Money.fromDecimal(10, 'EUR')),
    ).toBe(false);
  });

  it('serializes to a JSON-friendly representation', () => {
    expect(Money.fromDecimal(12.34, 'ARS').toJSON()).toEqual({
      amount: 12.34,
      currency: 'ARS',
    });
  });
});
