import accountingError from '@domain/accounting/errors/accounting.error';

import mapAccountingContextConflictErrorHelper from '@infra/persistence/helpers/map-accounting-context-conflict-error.helper';

describe('mapAccountingContextConflictErrorHelper', () => {
  const conflict = {
    code: '23505',
    constraint: 'accounting_contexts_fiscal_year_id_key',
  };
  it.each([conflict, { cause: conflict }, { cause: { cause: conflict } }])(
    'maps the accounting-context uniqueness violation: %j',
    (error) => {
      expect(mapAccountingContextConflictErrorHelper(error)).toBeInstanceOf(
        accountingError.AccountingContextAlreadyExists
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
    expect(mapAccountingContextConflictErrorHelper(error)).toBe(error);
  });
  it('terminates on cyclic error causes', () => {
    const error: { cause?: unknown } = {};
    error.cause = error;
    expect(mapAccountingContextConflictErrorHelper(error)).toBe(error);
  });
});
