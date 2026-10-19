import generateUUID from '@shared/utils/uuid-generator';

import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';
import getPeriodContainingCurrentDateHelper from '@domain/accounting/entities/helpers/get-current-period.helper';
import reportingPeriodEntity from '@domain/accounting/entities/reporting-period.entity';

describe('getPeriodContainingCurrentDateHelper', () => {
  const createdBy = generateUUID();
  const accountingEntityId = generateUUID();
  const [fiscalYear] = fiscalYearEntity.make({
    createdBy,
    accountingEntityId,
    startDate: new Date('2092-01-01'),
    endDate: new Date('2092-12-31'),
    status: 'open',
  });
  const periods = reportingPeriodEntity
    .make({
      createdBy,
      accountingEntityId,
      fiscalYear,
      unit: 'quarter',
      count: 4,
    })
    .map(([period]) => period);
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it.each([
    ['2092-01-01T00:00:00.000Z', 0],
    ['2092-03-31T23:59:59.999Z', 0],
    ['2092-04-01T00:00:00.000Z', 1],
    ['2092-12-31T23:59:59.999Z', 3],
  ])('selects the interval covering %s', (now, index) => {
    jest.setSystemTime(new Date(now));
    expect(getPeriodContainingCurrentDateHelper(periods)).toBe(periods[index]);
  });
  it.each(['2091-12-31T23:59:59.999Z', '2093-01-01T00:00:00.000Z'])(
    'returns no period outside the fiscal year: %s',
    (now) => {
      jest.setSystemTime(new Date(now));
      expect(getPeriodContainingCurrentDateHelper(periods)).toBeUndefined();
    }
  );
  it('returns no period for an empty calendar', () => {
    expect(getPeriodContainingCurrentDateHelper([])).toBeUndefined();
  });
});
