import periodError from '@domain/accounting/errors/period.error';

import mapReportingPeriodDuplicateErrorHelper from '@infra/persistence/helpers/map-reporting-period-duplicate-error.helper';

describe('mapReportingPeriodDuplicateErrorHelper', () => {
  const conflict = {
    code: '23505',
    constraint: 'reporting_periods_fiscal_year_start_date_key',
  };
  it.each([conflict, { cause: conflict }, { cause: { cause: conflict } }])(
    'maps the reporting-period uniqueness violation: %j',
    (error) => {
      expect(mapReportingPeriodDuplicateErrorHelper(error)).toBeInstanceOf(
        periodError.DuplicateReportingPeriods
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
    expect(mapReportingPeriodDuplicateErrorHelper(error)).toBe(error);
  });
  it('terminates on cyclic error causes', () => {
    const error: { cause?: unknown } = {};
    error.cause = error;
    expect(mapReportingPeriodDuplicateErrorHelper(error)).toBe(error);
  });
});
