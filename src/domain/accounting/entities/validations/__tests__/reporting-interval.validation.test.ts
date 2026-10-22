import { TEntityId } from '@shared/types/uuid';
import intervalError from '@shared/values/interval/interval.error';

import reportingIntervalEntity from '@domain/accounting/entities/reporting-interval.entity';
import reportingIntervalValidation from '@domain/accounting/entities/validations/reporting-interval.validation';
import accountingError from '@domain/accounting/errors/accounting.error';
import periodError from '@domain/accounting/errors/period.error';

function makeInterval() {
  return reportingIntervalEntity.make(
    {
      accountingEntityId: '11111111-1111-4111-8111-111111111111' as TEntityId,
      fiscalYearId: '22222222-2222-4222-8222-222222222222' as TEntityId,
      createdBy: '33333333-3333-4333-8333-333333333333' as TEntityId,
      unit: 'month',
      count: 2,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-03-01'),
      periods: [{ name: 'January' }, { name: 'February' }],
    },
    new Date('2024-01-15')
  )[0];
}

describe('reportingIntervalValidation', () => {
  it('accepts domain calendars and their definitions', () => {
    const interval = makeInterval();
    expect(() => reportingIntervalValidation.validate(interval)).not.toThrow();
    expect(() =>
      reportingIntervalValidation.validateCreation(interval)
    ).not.toThrow();
    expect(() =>
      reportingIntervalValidation.validateDefinition(interval)
    ).not.toThrow();
    expect(() =>
      reportingIntervalValidation.validateUnit('quarter')
    ).not.toThrow();
    expect(Object.isFrozen(reportingIntervalValidation)).toBe(true);
  });

  it('rejects invalid domain ownership, units, and dates', () => {
    const interval = makeInterval();
    expect(() =>
      reportingIntervalValidation.validate({
        ...interval,
        fiscalYearId: 'bad' as TEntityId,
      })
    ).toThrow(accountingError.InvalidFiscalYearId);
    expect(() =>
      reportingIntervalValidation.validate({
        ...interval,
        createdBy: 'bad' as TEntityId,
      })
    ).toThrow(accountingError.InvalidCreatedBy);
    expect(() =>
      reportingIntervalValidation.validateUnit('minute' as typeof interval.unit)
    ).toThrow(periodError.InvalidUnit);
    expect(() =>
      reportingIntervalValidation.validateDefinition({ ...interval, count: 0 })
    ).toThrow(intervalError.InvalidCount);
    expect(() =>
      reportingIntervalValidation.validate({
        ...interval,
        createdAt: new Date(NaN),
      })
    ).toThrow(accountingError.InvalidDate);
    expect(() =>
      reportingIntervalValidation.validate({
        ...interval,
        updatedAt: new Date(NaN),
      })
    ).toThrow(accountingError.InvalidDate);
  });

  it('validates the child domain metadata as well as calendar integrity', () => {
    const interval = makeInterval();
    expect(() =>
      reportingIntervalValidation.validate({
        ...interval,
        periods: [
          { ...interval.periods[0], createdBy: 'bad' as TEntityId },
          interval.periods[1],
        ],
      })
    ).toThrow(accountingError.InvalidCreatedBy);
    expect(() =>
      reportingIntervalValidation.validate({
        ...interval,
        periods: [
          interval.periods[0],
          { ...interval.periods[1], startDate: new Date('2024-02-02') },
        ],
      })
    ).toThrow(intervalError.InvalidPeriods);
    expect(() =>
      reportingIntervalValidation.validate({
        ...interval,
        currentPeriodOrdinal: 2,
      })
    ).toThrow(intervalError.InvalidCurrentPeriod);
    expect(() =>
      reportingIntervalValidation.validate({
        ...interval,
        nextPeriodStartDate: null,
      })
    ).toThrow(intervalError.InvalidNextPeriodStartDate);
  });
});
