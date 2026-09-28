import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';

import { headerAccountNameAliasesReqValidation } from '@app/ledger/dtos/header-account/header-account.dto.validation';

const schema = headerAccountNameAliasesReqValidation;
const invalidNameKey = new ledgerAccountError.InvalidName().errorKey;

describe('headerAccountNameAliasesReqValidation', () => {
  it('accepts an empty object', () => {
    expect(schema.safeParse({}).success).toBe(true);
  });

  it.each(Object.keys(schema.shape))(
    'accepts an optional translated %s alias',
    (key) => {
      expect(schema.safeParse({ [key]: '  Épargne 資産  ' }).success).toBe(
        true
      );
      expect(schema.safeParse({ [key]: 'AB' }).success).toBe(true);
      expect(schema.safeParse({ [key]: 'A'.repeat(100) }).success).toBe(true);
    }
  );

  it.each(['', '   ', ' A ', 'A'.repeat(101), null, 12, false, [], {}])(
    'rejects invalid aliases with the field error key: %j',
    (value) => {
      const result = schema.safeParse({ receivables: value });
      expect(result.success).toBe(false);
      if (result.success) throw new Error('Expected invalid alias');
      for (const issue of result.error.issues) {
        expect(issue).toEqual(
          expect.objectContaining({
            path: ['receivables'],
            message: invalidNameKey,
          })
        );
      }
    }
  );

  it.each([null, [], 'names', 1, true, undefined])(
    'rejects non-object payloads: %j',
    (payload) => {
      const result = schema.safeParse(payload);
      expect(result.success).toBe(false);
      if (result.success) throw new Error('Expected invalid payload');
      expect(result.error.issues[0].message).toBe(invalidNameKey);
    }
  );

  it.each([
    'name',
    'accounts',
    'aliases',
    'code',
    'type',
    'currencyCode',
    'accountingEntityId',
    'createdBy',
    'suspense',
    'payables',
    'opening_balance_equity',
  ])('rejects unknown property %s', (key) => {
    const result = schema.safeParse({ [key]: 'value' });
    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected unknown property');
    expect(result.error.issues[0].message).toBe(invalidNameKey);
  });
});
