import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';

import mapLedgerBalanceFunctionalCurrencyErrorHelper from '@infra/persistence/helpers/map-ledger-balance-functional-currency-error.helper';

const constraint = 'ledger_account_balances_entity_functional_currency_check';
describe('mapLedgerBalanceFunctionalCurrencyErrorHelper', () => {
  it('maps the trigger rejection directly and through nested driver errors', () => {
    const error = { code: '23514', constraint };
    expect(mapLedgerBalanceFunctionalCurrencyErrorHelper(error)).toBeInstanceOf(
      accountingEntityError.FunctionalCurrencyMismatch
    );
    expect(
      mapLedgerBalanceFunctionalCurrencyErrorHelper({ cause: { cause: error } })
    ).toBeInstanceOf(accountingEntityError.FunctionalCurrencyMismatch);
  });
  it.each([
    null,
    undefined,
    'failure',
    42,
    new Error('unavailable'),
    {},
    { code: '23514' },
    { code: '23514', constraint: 'other' },
    { code: '23505', constraint },
    { cause: null },
  ])('preserves unrelated errors: %p', (error) =>
    expect(mapLedgerBalanceFunctionalCurrencyErrorHelper(error)).toBe(error)
  );
  it('handles cyclic error causes', () => {
    const error: { cause?: unknown } = {};
    error.cause = error;
    expect(mapLedgerBalanceFunctionalCurrencyErrorHelper(error)).toBe(error);
  });
});
