import accountingError from '@domain/accounting/errors/accounting.error';

import mapReportingContextConflictErrorHelper from '@infra/persistence/helpers/map-reporting-context-conflict-error.helper';

describe('mapReportingContextConflictErrorHelper', () => {
  const conflict = {
    code: '23505',
    constraint: 'reporting_contexts_accounting_context_id_key',
  };
  it.each([conflict, { cause: conflict }, { cause: { cause: conflict } }])(
    'maps the reporting-context uniqueness violation: %j',
    (error) => {
      expect(mapReportingContextConflictErrorHelper(error)).toBeInstanceOf(
        accountingError.ReportingContextAlreadyExists
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
    expect(mapReportingContextConflictErrorHelper(error)).toBe(error);
  });
  it('terminates on cyclic error causes', () => {
    const error: { cause?: unknown } = {};
    error.cause = error;
    expect(mapReportingContextConflictErrorHelper(error)).toBe(error);
  });
});
