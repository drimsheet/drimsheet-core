import { ELedgerType } from '@domain/ledger/types/ledger.types';

import { getChartOfAccountsQueryValidationSchema as schema } from '@app/ledger/dtos/chart-of-accounts/chart-of-accounts.dto.validation';

describe('getChartOfAccountsQueryValidationSchema', () => {
  it.each(['bank', 'BANK', '', '.*', '銀行'])(
    'accepts string search %j',
    (search) => {
      expect(schema.parse({ class: 'asset', search })).toEqual({
        class: 'asset',
        search,
      });
    }
  );

  it.each([null, 123, true, ['bank'], { name: 'bank' }])(
    'rejects non-string search %j',
    (search) => {
      const parsed = schema.safeParse({ class: 'asset', search });
      expect(parsed.success).toBe(false);
      expect(parsed.error?.issues[0].path).toEqual(['search']);
    }
  );

  it.each(Object.values(ELedgerType))(
    'accepts the %s class',
    (accountClass) => {
      expect(schema.parse({ class: accountClass })).toEqual({
        class: accountClass,
      });
    }
  );

  it.each([true, false])(
    'accepts omitHeaderAccounts=%s',
    (omitHeaderAccounts) => {
      expect(
        schema.safeParse({ class: 'asset', omitHeaderAccounts }).success
      ).toBe(true);
    }
  );

  it.each([undefined, null, '', 'invalid', 'Asset', ['asset'], 1])(
    'rejects invalid or missing class %j',
    (accountClass) => {
      const parsed = schema.safeParse({ class: accountClass });
      expect(parsed.success).toBe(false);
      expect(parsed.error?.issues[0]).toMatchObject({
        path: ['class'],
        message: 'ledger_error_ledger_account_type_invalid',
      });
    }
  );

  it.each(['true', 'false', 1, null])(
    'rejects non-boolean omitHeaderAccounts %j',
    (omitHeaderAccounts) => {
      expect(
        schema.safeParse({ class: 'asset', omitHeaderAccounts }).success
      ).toBe(false);
    }
  );
});
