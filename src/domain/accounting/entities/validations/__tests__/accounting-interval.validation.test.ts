import { TEntityId } from '@shared/types/uuid';
import intervalError from '@shared/values/interval/interval.error';

import accountingIntervalEntity from '@domain/accounting/entities/accounting-interval.entity';
import accountingIntervalValidation from '@domain/accounting/entities/validations/accounting-interval.validation';
import accountingError from '@domain/accounting/errors/accounting.error';
import periodError from '@domain/accounting/errors/period.error';

function makeInterval() {
  return accountingIntervalEntity.make(
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

describe('accountingIntervalValidation', () => {
  it('accepts domain calendars and their definitions', () => {
    const interval = makeInterval();
    expect(() => accountingIntervalValidation.validate(interval)).not.toThrow();
    expect(() =>
      accountingIntervalValidation.validateCreation(interval)
    ).not.toThrow();
    expect(() =>
      accountingIntervalValidation.validateDefinition(interval)
    ).not.toThrow();
    expect(() =>
      accountingIntervalValidation.validateUnit('quarter')
    ).not.toThrow();
    expect(Object.isFrozen(accountingIntervalValidation)).toBe(true);
  });

  it('rejects invalid domain ownership, units, and dates', () => {
    const interval = makeInterval();
    expect(() =>
      accountingIntervalValidation.validate({
        ...interval,
        fiscalYearId: 'bad' as TEntityId,
      })
    ).toThrow(accountingError.InvalidFiscalYearId);
    expect(() =>
      accountingIntervalValidation.validate({
        ...interval,
        createdBy: 'bad' as TEntityId,
      })
    ).toThrow(accountingError.InvalidCreatedBy);
    expect(() =>
      accountingIntervalValidation.validateUnit(
        'minute' as typeof interval.unit
      )
    ).toThrow(periodError.InvalidUnit);
    expect(() =>
      accountingIntervalValidation.validateDefinition({ ...interval, count: 0 })
    ).toThrow(intervalError.InvalidCount);
    expect(() =>
      accountingIntervalValidation.validate({
        ...interval,
        createdAt: new Date(NaN),
      })
    ).toThrow(accountingError.InvalidDate);
    expect(() =>
      accountingIntervalValidation.validate({
        ...interval,
        updatedAt: new Date(NaN),
      })
    ).toThrow(accountingError.InvalidDate);
  });

  it('validates the child domain metadata as well as calendar integrity', () => {
    const interval = makeInterval();
    expect(() =>
      accountingIntervalValidation.validate({
        ...interval,
        periods: [
          { ...interval.periods[0], createdBy: 'bad' as TEntityId },
          interval.periods[1],
        ],
      })
    ).toThrow(accountingError.InvalidCreatedBy);
    expect(() =>
      accountingIntervalValidation.validate({
        ...interval,
        periods: [
          interval.periods[0],
          { ...interval.periods[1], startDate: new Date('2024-02-02') },
        ],
      })
    ).toThrow(intervalError.InvalidPeriods);
    expect(() =>
      accountingIntervalValidation.validate({
        ...interval,
        currentPeriodOrdinal: 2,
      })
    ).toThrow(intervalError.InvalidCurrentPeriod);
    expect(() =>
      accountingIntervalValidation.validate({
        ...interval,
        nextPeriodStartDate: null,
      })
    ).toThrow(intervalError.InvalidNextPeriodStartDate);
  });
});
