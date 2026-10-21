import generateUUID from '@shared/utils/uuid-generator';

import {
  fiscalYearCreationDtoSchema,
  getFiscalYearParamsValidationSchema,
} from '@app/accounting/dtos/fiscal-year/fiscal-year.dto.validation';

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

describe('get fiscal-year params DTO', () => {
  it('accepts a fiscal-year UUID', () => {
    const params = { id: generateUUID() };
    expect(getFiscalYearParamsValidationSchema.parse(params)).toEqual(params);
  });

  it.each([undefined, null, '', 'invalid', 42])(
    'rejects invalid IDs with the fiscal-year error key: %j',
    (id) => {
      const validation = getFiscalYearParamsValidationSchema.safeParse({ id });
      expect(validation.success).toBe(false);
      expect(validation.error?.issues).toEqual([
        expect.objectContaining({
          path: ['id'],
          message: 'accounting_error_period_fiscal_year_id_invalid',
        }),
      ]);
    }
  );
});
