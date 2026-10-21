import { EAccountingEntityType } from '@domain/accounting/types/accounting-entity.types';

import {
  accountingEntityCreationDtoSchema,
  accountingEntitySwitchReqSchema,
  accountingEntityTypeValidation,
  accountingEntityUpdateReqSchema,
  accountingStandardCodeValidation,
  jurisdictionCodeValidation,
  periodDayValidation,
  periodMonthValidation,
} from '@app/accounting/dtos/accounting/accounting.dto.validation';

describe('Accounting DTO Validation', () => {
  describe('jurisdictionCodeValidation', () => {
    it('should validate a correct jurisdiction code', () => {
      expect(jurisdictionCodeValidation.safeParse('GB').success).toBe(true);
    });

    it('should fail on unsupported jurisdiction code', () => {
      expect(jurisdictionCodeValidation.safeParse('ZZ').success).toBe(false);
    });
  });

  describe('accountingEntityTypeValidation', () => {
    it('should validate all valid accounting entity types', () => {
      expect(
        accountingEntityTypeValidation.safeParse(
          EAccountingEntityType.Individual
        ).success
      ).toBe(true);
      expect(
        accountingEntityTypeValidation.safeParse(
          EAccountingEntityType.SoleTrader
        ).success
      ).toBe(true);
      expect(
        accountingEntityTypeValidation.safeParse(
          EAccountingEntityType.PrivateCompany
        ).success
      ).toBe(true);
    });

    it('should fail on invalid accounting entity type', () => {
      expect(
        accountingEntityTypeValidation.safeParse('InvalidType').success
      ).toBe(false);
    });
  });

  describe('accountingStandardCodeValidation', () => {
    it('should validate a correct accounting standard code', () => {
      expect(
        accountingStandardCodeValidation.safeParse('UK_GAAP').success
      ).toBe(true);
    });

    it('should fail on unsupported accounting standard code', () => {
      expect(
        accountingStandardCodeValidation.safeParse('INVALID_STANDARD').success
      ).toBe(false);
    });
  });

  describe('periodDayValidation', () => {
    it('should validate correct days', () => {
      expect(periodDayValidation.safeParse(1).success).toBe(true);
      expect(periodDayValidation.safeParse(15).success).toBe(true);
      expect(periodDayValidation.safeParse(31).success).toBe(true);
    });

    it('should fail on invalid days', () => {
      expect(periodDayValidation.safeParse(0).success).toBe(false);
      expect(periodDayValidation.safeParse(32).success).toBe(false);
      expect(periodDayValidation.safeParse(-5).success).toBe(false);
    });
  });

  describe('periodMonthValidation', () => {
    it('should validate correct months', () => {
      expect(periodMonthValidation.safeParse(1).success).toBe(true);
      expect(periodMonthValidation.safeParse(6).success).toBe(true);
      expect(periodMonthValidation.safeParse(12).success).toBe(true);
    });

    it('should fail on invalid months', () => {
      expect(periodMonthValidation.safeParse(0).success).toBe(false);
      expect(periodMonthValidation.safeParse(13).success).toBe(false);
      expect(periodMonthValidation.safeParse(-1).success).toBe(false);
    });
  });

  describe('accountingEntitySwitchReqSchema', () => {
    it('should validate an accounting entity switch request', () => {
      expect(
        accountingEntitySwitchReqSchema.safeParse({
          accountingEntityId: '123e4567-e89b-12d3-a456-426614174000',
        }).success
      ).toBe(true);
    });

    it.each([
      ['a malformed ID', { accountingEntityId: 'not-a-uuid' }],
      ['a missing ID', {}],
      [
        'a caller-supplied user ID',
        {
          accountingEntityId: '123e4567-e89b-12d3-a456-426614174000',
          userId: '123e4567-e89b-12d3-a456-426614174001',
        },
      ],
    ])('should reject %s', (_label, payload) => {
      expect(accountingEntitySwitchReqSchema.safeParse(payload).success).toBe(
        false
      );
    });
  });
});

describe('accountingEntityUpdateReqSchema', () => {
  it.each([
    { name: 'New' },
    { entityType: 'private_company' },
    { functionalCurrencyCode: 'USD' },
    { name: 'New', entityType: 'sole_trader', functionalCurrencyCode: 'NGN' },
  ])('accepts %j', (payload) => {
    expect(accountingEntityUpdateReqSchema.safeParse(payload).success).toBe(
      true
    );
  });
  it.each([
    {},
    { name: undefined },
    { name: null },
    { entityType: null },
    { functionalCurrencyCode: null },
    { name: 1 },
    { entityType: 'provate_company' },
    { functionalCurrencyCode: 'US' },
    { name: 'New', ownerId: 'other' },
  ])('rejects %j', (payload) =>
    expect(accountingEntityUpdateReqSchema.safeParse(payload).success).toBe(
      false
    )
  );
});

describe('accountingEntityCreationDtoSchema', () => {
  const payload = {
    name: 'Entity only',
    entityType: 'sole_trader',
    jurisdictionCode: 'NG',
    functionalCurrencyCode: 'NGN',
  };

  it('requires only entity identity and currency fields', () => {
    expect(accountingEntityCreationDtoSchema.parse(payload)).toEqual(payload);
  });

  it.each([
    'name',
    'entityType',
    'jurisdictionCode',
    'functionalCurrencyCode',
  ] as const)('rejects a missing %s', (field) => {
    const missing: Partial<typeof payload> = { ...payload };
    delete missing[field];
    expect(accountingEntityCreationDtoSchema.safeParse(missing).success).toBe(
      false
    );
  });

  it.each([
    'fiscalYear',
    'accountingPeriod',
    'reportingPeriod',
    'accountingStandardCode',
    'reportingCurrencyCode',
    'appPreferences',
    'ownerId',
    'createdBy',
  ])('rejects obsolete or caller-owned field %s', (field) => {
    expect(
      accountingEntityCreationDtoSchema.safeParse({ ...payload, [field]: {} })
        .success
    ).toBe(false);
  });
});
