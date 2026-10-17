import generateUUID from '@shared/utils/uuid-generator';

import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';

import fiscalYearDtoMapper from '@app/accounting/dtos/fiscal-year/fiscal-year.dto.mapper';
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
  it('maps only the public fiscal-year fields', () => {
    const [year] = fiscalYearEntity.make({
      ...input,
      createdBy: generateUUID(),
    });
    expect(fiscalYearDtoMapper.toDto(year)).toEqual({
      id: year.id,
      createdBy: year.createdBy,
      name: year.name,
      accountingEntityId: year.accountingEntityId,
      startDate: year.startDate,
      endDate: year.endDate,
      status: year.status,
      closedAt: year.closedAt,
      updatedAt: year.updatedAt,
    });
    expect(fiscalYearDtoMapper.toDto(year)).not.toBe(year);
  });
});
