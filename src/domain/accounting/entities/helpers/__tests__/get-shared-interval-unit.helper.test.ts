import getSharedIntervalUnitHelper from '@domain/accounting/entities/helpers/get-shared-interval-unit.helper';

describe('getSharedIntervalUnitHelper', () => {
  it('maps quarter to the shared monthly calendar', () => {
    expect(getSharedIntervalUnitHelper('quarter')).toBe('month');
  });

  it.each(['day', 'week', 'month', 'year'] as const)('preserves %s', (unit) => {
    expect(getSharedIntervalUnitHelper(unit)).toBe(unit);
  });
});
