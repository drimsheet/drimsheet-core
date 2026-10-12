import { TEntityId } from '@shared/types/uuid';

import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';
import accountingPeriodValidation from '@domain/accounting/entities/validations/accounting-period.validation';
import periodError from '@domain/accounting/errors/period.error';
import { EPeriodStatus } from '@domain/accounting/types/period.types';

const accountingEntityId = '98402eb7-ec79-436f-b258-00a4fb9a572a' as TEntityId;
const [fiscalYear] = fiscalYearEntity.make({
  createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
  accountingEntityId,
  startDate: new Date('2096-01-01'),
  endDate: new Date('2096-12-31'),
  status: EPeriodStatus.Open,
});

describe('accountingPeriodValidation', () => {
  it('requires matching fiscal-year ownership', () => {
    expect(() =>
      accountingPeriodValidation.validateFiscalYearOwnership(
        accountingEntityId,
        fiscalYear
      )
    ).not.toThrow();
    expect(() =>
      accountingPeriodValidation.validateFiscalYearOwnership(
        'a1111111-1111-4111-8111-111111111111' as TEntityId,
        fiscalYear
      )
    ).toThrow(periodError.InvalidAccountingEntityId);
  });
});

const range = (start: string, end: string) => ({
  startDate: new Date(start),
  endDate: new Date(end),
});
const partitionYear = range('2028-01-01', '2028-01-07');

describe('accountingPeriodValidation.validatePartition', () => {
  it('accepts a complete inclusive partition', () => {
    expect(() =>
      accountingPeriodValidation.validatePartition(
        [range('2028-01-01', '2028-01-03'), range('2028-01-04', '2028-01-07')],
        partitionYear
      )
    ).not.toThrow();
  });
  it.each([
    [],
    [range('2028-01-01', '2028-01-06')],
    [range('2028-01-02', '2028-01-07')],
    [range('2028-01-01', '2028-01-04'), range('2028-01-04', '2028-01-07')],
    [range('2028-01-01', '2028-01-02'), range('2028-01-04', '2028-01-07')],
    [range('2028-01-01', '2028-01-07'), range('2028-01-08', '2028-01-07')],
    [range('2028-01-04', '2028-01-07'), range('2028-01-01', '2028-01-07')],
  ])(
    'rejects an empty, incomplete, overlapping or unordered partition %#',
    (...intervals) => {
      expect(() =>
        accountingPeriodValidation.validatePartition(intervals, partitionYear)
      ).toThrow(periodError.InvalidInterval);
    }
  );
  it('rejects invalid dates before calendar conversion', () => {
    expect(() =>
      accountingPeriodValidation.validatePartition(
        [range('invalid', '2028-01-07')],
        partitionYear
      )
    ).toThrow(periodError.InvalidDateRange);
  });
});
