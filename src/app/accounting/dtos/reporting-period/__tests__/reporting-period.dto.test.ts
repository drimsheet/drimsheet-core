import generateUUID from '@shared/utils/uuid-generator';

import { EPeriodUnit } from '@domain/accounting/types/period.types';

import { reportingPeriodsCreationDtoSchema } from '@app/accounting/dtos/reporting-period/reporting-period.dto.validation';

describe('reporting-period DTO', () => {
  const input = {
    fiscalYearId: generateUUID(),
    unit: 'month' as const,
    count: 12,
  };

  it.each(Object.values(EPeriodUnit))('accepts the %s unit', (unit) => {
    expect(reportingPeriodsCreationDtoSchema.parse({ ...input, unit })).toEqual(
      { ...input, unit }
    );
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
      reportingPeriodsCreationDtoSchema.safeParse({ ...input, ...change })
        .success
    ).toBe(false);
  });
});
