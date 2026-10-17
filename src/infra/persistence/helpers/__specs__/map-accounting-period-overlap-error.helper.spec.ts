import periodError from '@domain/accounting/errors/period.error';

import mapAccountingPeriodOverlapErrorHelper from '@infra/persistence/helpers/map-accounting-period-overlap-error.helper';

describe('mapAccountingPeriodOverlapErrorHelper', () => {
  const conflict = {
    code: '23P01',
    constraint: 'accounting_periods_entity_dates_excl',
  };
  it.each([conflict, { cause: conflict }, { cause: { cause: conflict } }])(
    'maps the accounting-period exclusion violation: %j',
    (error) => {
      expect(mapAccountingPeriodOverlapErrorHelper(error)).toBeInstanceOf(
        periodError.OverlappingPeriods
      );
    }
  );
  it.each([
    null,
    undefined,
    'failure',
    {},
    { code: '23505', constraint: conflict.constraint },
    { code: '23P01', constraint: 'other' },
    { code: '23P01' },
    { cause: {} },
  ])('preserves unrelated failures: %j', (error) => {
    expect(mapAccountingPeriodOverlapErrorHelper(error)).toBe(error);
  });
  it('terminates on cyclic error causes', () => {
    const error: { cause?: unknown } = {};
    error.cause = error;
    expect(mapAccountingPeriodOverlapErrorHelper(error)).toBe(error);
  });
});
