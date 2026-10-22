import accountingError from '@domain/accounting/errors/accounting.error';

import mapAccountingIntervalConflictErrorHelper from '@infra/persistence/helpers/map-accounting-interval-conflict-error.helper';

describe('mapAccountingIntervalConflictErrorHelper', () => {
  const conflict = {
    code: '23505',
    constraint: 'accounting_intervals_fiscal_year_id_key',
  };
  it.each([conflict, { cause: conflict }, { cause: { cause: conflict } }])(
    'maps the accounting-interval uniqueness violation: %j',
    (error) => {
      expect(mapAccountingIntervalConflictErrorHelper(error)).toBeInstanceOf(
        accountingError.AccountingIntervalAlreadyExists
      );
    }
  );
  it.each([
    null,
    undefined,
    'failure',
    {},
    { code: '23P01', constraint: conflict.constraint },
    { code: '23505', constraint: 'other' },
    { code: '23505' },
    { cause: {} },
  ])('preserves unrelated failures: %j', (error) => {
    expect(mapAccountingIntervalConflictErrorHelper(error)).toBe(error);
  });
  it('terminates on cyclic error causes', () => {
    const error: { cause?: unknown } = {};
    error.cause = error;
    expect(mapAccountingIntervalConflictErrorHelper(error)).toBe(error);
  });
});
