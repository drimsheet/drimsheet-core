import generateUUID from '@shared/utils/uuid-generator';

import ledgerAccountBalanceEntity from '@domain/ledger/entities/ledger-account-balance.entity';
import ledgerAccountBalanceValidation from '@domain/ledger/entities/validations/ledger-account-balance.validation';
import ledgerAccountBalanceError from '@domain/ledger/errors/ledger-account-balance.error';
import currencyEntity from '@domain/money/entities/currency.entity';

describe('ledgerAccountBalanceValidation', () => {
  it('exposes the frozen ledger-account-balance validators', () => {
    expect(Object.isFrozen(ledgerAccountBalanceValidation)).toBe(true);
    expect(ledgerAccountBalanceEntity.validateEffectType).toBe(
      ledgerAccountBalanceValidation.validateEffectType
    );
    expect(Object.keys(ledgerAccountBalanceValidation)).toEqual([
      'validateEffectType',
      'validateCurrencyChange',
    ]);
    expect(Object.values(ledgerAccountBalanceValidation)).toEqual(
      expect.arrayContaining([expect.any(Function)])
    );
  });
});

describe('validateCurrencyChange', () => {
  const makeBalance = () =>
    ledgerAccountBalanceEntity.make({
      createdBy: generateUUID(),
      ledgerAccountId: generateUUID(),
      accountingEntityId: generateUUID(),
      accountMaterializedPath: '100000',
      currencyCode: 'NGN',
      functionalCurrencyCode: 'NGN',
    });

  it('accepts a balance with zero transaction and functional amounts', () => {
    expect(() =>
      ledgerAccountBalanceValidation.validateCurrencyChange(makeBalance())
    ).not.toThrow();
  });

  it.each([
    [1n, 0n],
    [0n, 1n],
    [-1n, 0n],
    [0n, -1n],
  ])(
    'rejects redenominating transaction %s and functional %s balances',
    (amount, functionalAmount) => {
      const original = makeBalance();
      const { newBalance } = ledgerAccountBalanceEntity.adjust(original, {
        ledgerAccountId: original.ledgerAccountId,
        createdBy: original.createdBy,
        journalEntryId: generateUUID(),
        amount: { amount, currency: currencyEntity.getByCode('NGN') },
        functionalAmount: {
          amount: functionalAmount,
          currency: currencyEntity.getByCode('NGN'),
        },
      });
      expect(() =>
        ledgerAccountBalanceValidation.validateCurrencyChange(newBalance)
      ).toThrow(ledgerAccountBalanceError.CurrencyChangeNonZeroBalance);
      expect(() =>
        ledgerAccountBalanceEntity.changeCurrency(
          newBalance,
          currencyEntity.getByCode('USD')
        )
      ).toThrow(ledgerAccountBalanceError.CurrencyChangeNonZeroBalance);
      expect(newBalance.amount.currency.code).toBe('NGN');
    }
  );
});
