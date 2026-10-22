import { TEntityId } from '@shared/types/uuid';
import sharedPeriodError from '@shared/values/interval/period.error';

import accountingIntervalEntity from '@domain/accounting/entities/accounting-interval.entity';
import accountingPeriodValidation from '@domain/accounting/entities/validations/accounting-period.validation';
import accountingError from '@domain/accounting/errors/accounting.error';
import periodError from '@domain/accounting/errors/period.error';

function makePeriod() {
  const [interval] = accountingIntervalEntity.make({
    accountingEntityId: '11111111-1111-4111-8111-111111111111' as TEntityId,
    fiscalYearId: '22222222-2222-4222-8222-222222222222' as TEntityId,
    createdBy: '33333333-3333-4333-8333-333333333333' as TEntityId,
    unit: 'month',
    count: 1,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-02-01'),
    periods: [{ name: 'January' }],
  });
  return interval.periods[0];
}

describe('accountingPeriodValidation', () => {
  it('accepts a constructed period and exposes shared validation', () => {
    const period = makePeriod();
    expect(() => accountingPeriodValidation.validate(period)).not.toThrow();
    expect(() =>
      accountingPeriodValidation.validateCreation(period, period)
    ).not.toThrow();
    expect(() =>
      accountingPeriodValidation.validateName('Valid')
    ).not.toThrow();
    expect(() => accountingPeriodValidation.validateOrdinal(0)).not.toThrow();
    expect(Object.isFrozen(accountingPeriodValidation)).toBe(true);
  });

  it('rejects invalid child identity and domain metadata', () => {
    const period = makePeriod();
    expect(() =>
      accountingPeriodValidation.validate({ ...period, id: 'bad' as TEntityId })
    ).toThrow(sharedPeriodError.InvalidId);
    expect(() =>
      accountingPeriodValidation.validate({
        ...period,
        intervalId: 'bad' as TEntityId,
      })
    ).toThrow(sharedPeriodError.InvalidIntervalId);
    expect(() =>
      accountingPeriodValidation.validate({
        ...period,
        createdBy: 'bad' as TEntityId,
      })
    ).toThrow(accountingError.InvalidCreatedBy);
    expect(() =>
      accountingPeriodValidation.validate({
        ...period,
        createdAt: new Date(NaN),
      })
    ).toThrow(accountingError.InvalidDate);
    expect(() =>
      accountingPeriodValidation.validate({
        ...period,
        updatedAt: new Date(NaN),
      })
    ).toThrow(accountingError.InvalidDate);
  });

  it('allows only open or closed state with matching closure metadata', () => {
    const period = makePeriod();
    expect(() =>
      accountingPeriodValidation.validate({
        ...period,
        status: 'pending' as typeof period.status,
      })
    ).toThrow(periodError.InvalidStatus);
    expect(() =>
      accountingPeriodValidation.validate({
        ...period,
        closedAt: new Date('2024-02-01'),
      })
    ).toThrow(periodError.InvalidStatus);
    expect(() =>
      accountingPeriodValidation.validate({
        ...period,
        status: 'closed',
        closedAt: null,
      })
    ).toThrow(accountingError.InvalidDate);
    expect(() =>
      accountingPeriodValidation.validate({
        ...period,
        status: 'closed',
        closedAt: new Date(NaN),
      })
    ).toThrow(accountingError.InvalidDate);
    expect(() =>
      accountingPeriodValidation.validate({
        ...period,
        status: 'closed',
        closedAt: new Date('2024-02-01'),
      })
    ).not.toThrow();
  });
});
