import { createSuspenseAccountValidation } from '@app/ledger/dtos/suspense-account/suspense-account.dto.validation';

describe('createSuspenseAccountValidation', () => {
  const valid = { name: 'Suspense', type: 'asset', currencyCode: 'USD' };

  it.each(['asset', 'liability'])(
    'accepts %s and the common monetary input',
    (type) => {
      expect(createSuspenseAccountValidation.parse({ ...valid, type })).toEqual(
        { ...valid, type }
      );
    }
  );

  it.each([
    {},
    [],
    [valid],
    { ...valid, name: 'A' },
    { ...valid, name: 'x'.repeat(101) },
    { ...valid, type: 'expense' },
    { ...valid, currencyCode: 'US' },
    { ...valid, name: undefined },
    { ...valid, type: undefined },
    { ...valid, currencyCode: undefined },
    { ...valid, currencyCode: null },
  ])('rejects an invalid request %o', (payload) => {
    expect(createSuspenseAccountValidation.safeParse(payload).success).toBe(
      false
    );
  });

  it.each([
    'controlAccountId',
    'controlAccount',
    'isControlAccount',
    'subType',
    'behavior',
    'meta',
    'key',
    'createdBy',
    'accountingEntityId',
    'code',
    'materializedPath',
    'openingBalance',
    'createdAt',
  ])('rejects the override %s', (key) => {
    expect(
      createSuspenseAccountValidation.safeParse({ ...valid, [key]: 'forged' })
        .success
    ).toBe(false);
  });
});
