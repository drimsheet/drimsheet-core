import { TEntityId } from '@shared/types/uuid';
import sharedPeriodError from '@shared/values/interval/period.error';

import reportingIntervalEntity from '@domain/accounting/entities/reporting-interval.entity';
import reportingPeriodValidation from '@domain/accounting/entities/validations/reporting-period.validation';
import accountingError from '@domain/accounting/errors/accounting.error';

function makePeriod() {
  const [interval] = reportingIntervalEntity.make({
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

describe('reportingPeriodValidation', () => {
  it('accepts a constructed period and exposes shared validation', () => {
    const period = makePeriod();
    expect(() => reportingPeriodValidation.validate(period)).not.toThrow();
    expect(() =>
      reportingPeriodValidation.validateCreation(period, period)
    ).not.toThrow();
    expect(() => reportingPeriodValidation.validateName('Valid')).not.toThrow();
    expect(() => reportingPeriodValidation.validateOrdinal(0)).not.toThrow();
    expect(Object.isFrozen(reportingPeriodValidation)).toBe(true);
  });

  it('rejects invalid child identity and domain metadata', () => {
    const period = makePeriod();
    expect(() =>
      reportingPeriodValidation.validate({ ...period, id: 'bad' as TEntityId })
    ).toThrow(sharedPeriodError.InvalidId);
    expect(() =>
      reportingPeriodValidation.validate({
        ...period,
        intervalId: 'bad' as TEntityId,
      })
    ).toThrow(sharedPeriodError.InvalidIntervalId);
    expect(() =>
      reportingPeriodValidation.validate({
        ...period,
        createdBy: 'bad' as TEntityId,
      })
    ).toThrow(accountingError.InvalidCreatedBy);
    expect(() =>
      reportingPeriodValidation.validate({
        ...period,
        createdAt: new Date(NaN),
      })
    ).toThrow(accountingError.InvalidDate);
    expect(() =>
      reportingPeriodValidation.validate({
        ...period,
        updatedAt: new Date(NaN),
      })
    ).toThrow(accountingError.InvalidDate);
  });
});
