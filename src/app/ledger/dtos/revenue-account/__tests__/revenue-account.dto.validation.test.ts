import { createRevenueAccountValidation } from '@app/ledger/dtos/revenue-account/revenue-account.dto.validation';

describe('createRevenueAccountValidation', () => {
  const schema = createRevenueAccountValidation;
  const valid = {
    name: 'Custom account',
    isControlAccount: false,
    behavior: 'services',
  };
  it.each([undefined, 'active', 'draft'])(
    'accepts creation status %s',
    (status) => {
      expect(schema.safeParse({ ...valid, status }).success).toBe(true);
    }
  );
  it.each(['archived', 'invalid', null])(
    'rejects creation status %s',
    (status) => {
      const result = schema.safeParse({ ...valid, status });
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: ['status'],
              message: 'ledger_error_ledger_account_status_invalid',
            }),
          ])
        );
    }
  );
  it('accepts a single account with an optional UUID parent', () => {
    expect(schema.safeParse(valid).success).toBe(true);
    expect(
      schema.safeParse({
        ...valid,
        controlAccountId: '123e4567-e89b-42d3-a456-426614174000',
      }).success
    ).toBe(true);
  });
  it.each(['', 'a', 'a'.repeat(101)])('rejects invalid name %s', (name) => {
    expect(schema.safeParse({ ...valid, name }).success).toBe(false);
  });
  it.each(['name', 'isControlAccount'])('requires %s', (field) => {
    const payload: Record<string, unknown> = { ...valid };
    delete payload[field];
    expect(schema.safeParse(payload).success).toBe(false);
  });
  it('rejects invalid parent IDs and boolean strings', () => {
    expect(
      schema.safeParse({ ...valid, controlAccountId: 'not-a-uuid' }).success
    ).toBe(false);
    expect(
      schema.safeParse({ ...valid, isControlAccount: 'false' }).success
    ).toBe(false);
  });
  it.each([
    'type',
    'subType',
    'controlAccount',
    'key',
    'code',
    'materializedPath',
    'createdBy',
    'accountingEntityId',
    'createdAt',
    'openingBalance',
  ])('rejects unexpected field %s', (field) => {
    expect(schema.safeParse({ ...valid, [field]: 'forged' }).success).toBe(
      false
    );
  });
  it.each([[], [valid], null, 'account'])(
    'rejects non-object inputs',
    (payload) => {
      expect(schema.safeParse(payload).success).toBe(false);
    }
  );
  it.each([
    'services',
    'employment_income',
    'gain_on_asset_sale',
    'unrealized_gains',
    'grants',
    'gifts',
  ])('accepts supported behavior %s', (behavior) => {
    expect(schema.safeParse({ ...valid, behavior }).success).toBe(true);
  });
  it.each([
    undefined,
    'default',
    'sales',
    'payroll_and_personnel',
    'income_tax_expense',
    'loss_on_asset_disposal',
    'direct_costs',
  ])('rejects unsupported behavior %s', (behavior) => {
    expect(schema.safeParse({ ...valid, behavior }).success).toBe(false);
  });
  it('rejects currency overrides', () => {
    expect(schema.safeParse({ ...valid, currencyCode: 'USD' }).success).toBe(
      false
    );
  });
  it('rejects arbitrary metadata', () => {
    expect(schema.safeParse({ ...valid, meta: {} }).success).toBe(false);
  });
});
