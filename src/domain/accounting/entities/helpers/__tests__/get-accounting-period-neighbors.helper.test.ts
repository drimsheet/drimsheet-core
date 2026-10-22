import generateUUID from '@shared/utils/uuid-generator';

import accountingPeriodEntity from '@domain/accounting/entities/accounting-period.entity.deprecated';
import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';
import getAccountingPeriodNeighborsHelper from '@domain/accounting/entities/helpers/get-accounting-period-neighbors.helper';
import accountingError from '@domain/accounting/errors/accounting.error';

describe('getAccountingPeriodNeighborsHelper', () => {
  const createdBy = generateUUID();
  const accountingEntityId = generateUUID();
  const [fiscalYear] = fiscalYearEntity.make({
    createdBy,
    accountingEntityId,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    status: 'open',
  });
  const periods = accountingPeriodEntity
    .make({
      createdBy,
      accountingEntityId,
      fiscalYear,
      unit: 'month',
      count: 12,
    })
    .map(([period]) => period);

  it('selects the immediate chronological neighbors without mutating the input', () => {
    const unorderedPeriods = Object.freeze([...periods].reverse());

    expect(
      getAccountingPeriodNeighborsHelper(unorderedPeriods, periods[5].id)
    ).toEqual({
      previousAccountingPeriodId: periods[4].id,
      nextAccountingPeriodId: periods[6].id,
    });
    expect(unorderedPeriods).toEqual([...periods].reverse());
  });

  it('returns null only for a missing neighbor at either end', () => {
    expect(getAccountingPeriodNeighborsHelper(periods, periods[0].id)).toEqual({
      previousAccountingPeriodId: null,
      nextAccountingPeriodId: periods[1].id,
    });
    expect(getAccountingPeriodNeighborsHelper(periods, periods[11].id)).toEqual(
      {
        previousAccountingPeriodId: periods[10].id,
        nextAccountingPeriodId: null,
      }
    );
  });

  it('returns null for both neighbors of a sole period', () => {
    expect(
      getAccountingPeriodNeighborsHelper([periods[0]], periods[0].id)
    ).toEqual({
      previousAccountingPeriodId: null,
      nextAccountingPeriodId: null,
    });
  });

  it('rejects a period absent from the supplied collection', () => {
    expect(() =>
      getAccountingPeriodNeighborsHelper(periods, generateUUID())
    ).toThrow(accountingError.InvalidCurrentAccountingPeriodId);
  });
});
