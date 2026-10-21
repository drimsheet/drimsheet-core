import generateUUID from '@shared/utils/uuid-generator';

import { fiscalYearCreationDtoSchema } from '@app/accounting/dtos/fiscal-year/fiscal-year.dto.validation';

describe('fiscal-year DTO', () => {
  const input = {
    accountingEntityId: generateUUID(),
    startDate: new Date('2090-01-01'),
    endDate: new Date('2090-12-31'),
    status: 'open' as const,
  };
  it('accepts explicit configuration with an optional name', () => {
    expect(fiscalYearCreationDtoSchema.parse(input)).toEqual(input);
    expect(fiscalYearCreationDtoSchema.parse({ ...input, name: 'FY' })).toEqual(
      { ...input, name: 'FY' }
    );
  });
  it.each([
    { accountingEntityId: 'invalid' },
    { startDate: '2090-01-01' },
    { endDate: null },
    { status: 'invalid' },
    { createdBy: generateUUID() },
    { name: 12 },
  ])('rejects invalid fields: %j', (change) => {
    expect(
      fiscalYearCreationDtoSchema.safeParse({ ...input, ...change }).success
    ).toBe(false);
  });
  it('leaves date ordering to the domain', () => {
    expect(
      fiscalYearCreationDtoSchema.safeParse({
        ...input,
        endDate: new Date('2089-12-31'),
      }).success
    ).toBe(true);
  });
});
