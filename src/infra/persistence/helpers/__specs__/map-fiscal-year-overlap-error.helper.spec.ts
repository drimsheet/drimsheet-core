import periodError from '@domain/accounting/errors/period.error';

import mapFiscalYearOverlapErrorHelper from '@infra/persistence/helpers/map-fiscal-year-overlap-error.helper';

describe('mapFiscalYearOverlapErrorHelper', () => {
  const conflict = {
    code: '23P01',
    constraint: 'fiscal_years_entity_dates_excl',
  };
  it.each([conflict, { cause: conflict }, { cause: { cause: conflict } }])(
    'maps the fiscal-year exclusion violation: %j',
    (error) => {
      expect(mapFiscalYearOverlapErrorHelper(error)).toBeInstanceOf(
        periodError.OverlappingFiscalYears
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
    expect(mapFiscalYearOverlapErrorHelper(error)).toBe(error);
  });
  it('terminates on cyclic error causes', () => {
    const error: { cause?: unknown } = {};
    error.cause = error;
    expect(mapFiscalYearOverlapErrorHelper(error)).toBe(error);
  });
});
