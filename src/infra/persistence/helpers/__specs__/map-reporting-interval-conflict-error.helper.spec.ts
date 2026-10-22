import accountingError from '@domain/accounting/errors/accounting.error';

import mapReportingIntervalConflictErrorHelper from '@infra/persistence/helpers/map-reporting-interval-conflict-error.helper';

describe('mapReportingIntervalConflictErrorHelper', () => {
  const conflict = {
    code: '23505',
    constraint: 'reporting_intervals_fiscal_year_id_key',
  };
  it.each([conflict, { cause: conflict }, { cause: { cause: conflict } }])(
    'maps the reporting-interval uniqueness violation: %j',
    (error) => {
      expect(mapReportingIntervalConflictErrorHelper(error)).toBeInstanceOf(
        accountingError.ReportingIntervalAlreadyExists
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
    expect(mapReportingIntervalConflictErrorHelper(error)).toBe(error);
  });
  it('terminates on cyclic error causes', () => {
    const error: { cause?: unknown } = {};
    error.cause = error;
    expect(mapReportingIntervalConflictErrorHelper(error)).toBe(error);
  });
});
