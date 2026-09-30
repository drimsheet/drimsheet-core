import {
  createStatutoryPayableAccountValidation,
  createTradePayableAccountValidation,
} from '@app/ledger/dtos/payable-account/payable-account.dto.validation';

describe('createTradePayableAccountValidation', () => {
  const schema = createTradePayableAccountValidation;
  const valid = { name: 'Custom account', isControlAccount: false };
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
  it('rejects a route-owned behavior override', () => {
    expect(
      schema.safeParse({ ...valid, behavior: 'trade_receivable' }).success
    ).toBe(false);
  });
  it('rejects currency overrides', () => {
    expect(schema.safeParse({ ...valid, currencyCode: 'USD' }).success).toBe(
      false
    );
  });
  const meta = {
    counterpartyId: '123e4567-e89b-42d3-a456-426614174000',
    invoiceId: '123e4567-e89b-42d3-a456-426614174001',
  };
  it('accepts omitted, null or defined metadata', () => {
    for (const value of [undefined, null, meta])
      expect(schema.safeParse({ ...valid, meta: value }).success).toBe(true);
  });
  it.each([{}, { ...meta, unexpected: true }, { ...meta, invoiceId: 42 }])(
    'rejects malformed metadata',
    (meta) => {
      expect(schema.safeParse({ ...valid, meta }).success).toBe(false);
    }
  );
});

describe('createStatutoryPayableAccountValidation', () => {
  const schema = createStatutoryPayableAccountValidation;
  const valid = {
    name: 'Custom account',
    isControlAccount: false,
    currencyCode: 'NGN',
  };
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
  it('rejects a route-owned behavior override', () => {
    expect(
      schema.safeParse({ ...valid, behavior: 'trade_receivable' }).success
    ).toBe(false);
  });
  it.each([undefined, null, 'INVALID', 42])(
    'rejects invalid currency %s',
    (currencyCode) => {
      expect(schema.safeParse({ ...valid, currencyCode }).success).toBe(false);
    }
  );
  const meta = { taxAuthority: 'FIRS', taxType: 'income_tax' };
  it('accepts omitted, null or defined metadata', () => {
    for (const value of [undefined, null, meta])
      expect(schema.safeParse({ ...valid, meta: value }).success).toBe(true);
  });
  it.each([{}, { ...meta, unexpected: true }, { ...meta, taxType: 42 }])(
    'rejects malformed metadata',
    (meta) => {
      expect(schema.safeParse({ ...valid, meta }).success).toBe(false);
    }
  );
});
