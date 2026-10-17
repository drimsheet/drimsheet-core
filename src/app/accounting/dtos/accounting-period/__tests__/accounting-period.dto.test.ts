import generateUUID from '@shared/utils/uuid-generator';

import accountingPeriodEntity from '@domain/accounting/entities/accounting-period.entity';
import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';
import { EPeriodUnit } from '@domain/accounting/types/period.types';

import accountingPeriodDtoMapper from '@app/accounting/dtos/accounting-period/accounting-period.dto.mapper';
import { accountingPeriodsCreationDtoSchema } from '@app/accounting/dtos/accounting-period/accounting-period.dto.validation';

describe('accounting-period DTO', () => {
  const input = {
    fiscalYearId: generateUUID(),
    unit: 'month' as const,
    count: 12,
  };

  it.each(Object.values(EPeriodUnit))('accepts the %s unit', (unit) => {
    expect(
      accountingPeriodsCreationDtoSchema.parse({ ...input, unit })
    ).toEqual({ ...input, unit });
  });

  it.each([
    { accountingEntityId: 'invalid' },
    { fiscalYearId: 'invalid' },
    { unit: 'invalid' },
    { count: 0 },
    { count: -1 },
    { count: 1.5 },
    { count: '12' },
    { count: Infinity },
    { createdBy: generateUUID() },
    { startDate: new Date('2090-01-01') },
  ])('rejects invalid fields: %j', (change) => {
    expect(
      accountingPeriodsCreationDtoSchema.safeParse({ ...input, ...change })
        .success
    ).toBe(false);
  });

  it('maps only the public period fields', () => {
    const createdBy = generateUUID();
    const [fiscalYear] = fiscalYearEntity.make({
      accountingEntityId: generateUUID(),
      createdBy,
      startDate: new Date('2090-01-01'),
      endDate: new Date('2090-12-31'),
      status: 'open',
    });
    const [creation] = accountingPeriodEntity.make({
      ...input,
      accountingEntityId: fiscalYear.accountingEntityId,
      createdBy,
      fiscalYear,
    });
    const [period] = creation;
    expect(accountingPeriodDtoMapper.toDto(period)).toEqual({
      id: period.id,
      createdBy,
      name: period.name,
      accountingEntityId: period.accountingEntityId,
      fiscalYearId: fiscalYear.id,
      unit: period.unit,
      count: period.count,
      startDate: period.startDate,
      endDate: period.endDate,
      status: period.status,
      closedAt: period.closedAt,
      updatedAt: period.updatedAt,
    });
    expect(accountingPeriodDtoMapper.toDto(period)).not.toBe(period);
  });
});
