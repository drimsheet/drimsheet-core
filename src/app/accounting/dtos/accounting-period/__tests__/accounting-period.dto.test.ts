import generateUUID from '@shared/utils/uuid-generator';

import { EPeriodUnit } from '@domain/accounting/types/period.types';

import {
  accountingPeriodsCreationDtoSchema,
  getAccountingPeriodParamsValidationSchema,
  getAccountingPeriodsParamsValidationSchema,
} from '@app/accounting/dtos/accounting-period/accounting-period.dto.validation';

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
});

describe('accounting-period read parameters', () => {
  it('accepts UUIDs for detail and fiscal-year collection reads', () => {
    const id = generateUUID();
    expect(getAccountingPeriodParamsValidationSchema.parse({ id })).toEqual({
      id,
    });
    expect(
      getAccountingPeriodsParamsValidationSchema.parse({ fiscalYearId: id })
    ).toEqual({ fiscalYearId: id });
  });

  it.each(['', 'invalid', undefined, 123])(
    'rejects invalid read IDs: %j',
    (id) => {
      const detail = getAccountingPeriodParamsValidationSchema.safeParse({
        id,
      });
      const collection = getAccountingPeriodsParamsValidationSchema.safeParse({
        fiscalYearId: id,
      });
      expect(detail.success).toBe(false);
      expect(collection.success).toBe(false);
      expect(detail.error?.issues[0]).toMatchObject({
        path: ['id'],
        message: 'accounting_error_id_invalid',
      });
      expect(collection.error?.issues[0]).toMatchObject({
        path: ['fiscalYearId'],
        message: 'accounting_error_period_fiscal_year_id_invalid',
      });
    }
  );
});
