import {
  createExpenseAccountValidation,
  updateExpenseAccountValidation,
} from '@app/ledger/dtos/expense-account/expense-account.dto.validation';

describe('createExpenseAccountValidation', () => {
  const schema = createExpenseAccountValidation;
  const valid = {
    name: 'Custom account',
    isControlAccount: false,
    behavior: 'default_direct_cost',
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
    'default_direct_cost',
    'cogs',
    'cost_of_services',
    'cost_of_revenue',
    'rent_and_utilities',
    'bank_charge',
    'finance_cost',
    'interest',
    'tax_expense',
    'unrealized_loss',
    'asset_disposal_loss',
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

describe('updateExpenseAccountValidation', () => {
  it('accepts a name update', () => {
    expect(
      updateExpenseAccountValidation.parse({ name: 'Consulting' })
    ).toEqual({ name: 'Consulting' });
  });

  it.each([
    {},
    { name: undefined },
    { name: null },
    { name: '' },
    { name: 'a' },
    { name: 'a'.repeat(101) },
    [],
    null,
  ])('rejects invalid input %j', (payload) => {
    expect(updateExpenseAccountValidation.safeParse(payload).success).toBe(
      false
    );
  });

  it.each([
    'behavior',
    'type',
    'subType',
    'status',
    'currencyCode',
    'controlAccountId',
    'isControlAccount',
    'openingBalance',
    'meta',
    'code',
    'materializedPath',
    'version',
    'expectedVersion',
    'createdBy',
    'accountingEntityId',
  ])('rejects changes to %s', (field) => {
    expect(
      updateExpenseAccountValidation.safeParse({
        name: 'Consulting',
        [field]: 'forged',
      }).success
    ).toBe(false);
  });
});
