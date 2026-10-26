import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';

import { getLedgerBalancesByCurrencyQueryValidationSchema } from '@app/reporting/dtos/ledger-balances-by-currency/ledger-balances-by-currency.dto.validation';

describe('getLedgerBalancesByCurrencyQueryValidationSchema', () => {
  it.each(['asset', 'liability'])('accepts %s', (type) => {
    expect(
      getLedgerBalancesByCurrencyQueryValidationSchema.parse({ type })
    ).toEqual({ type });
  });

  it.each([
    undefined,
    null,
    '',
    'equity',
    'revenue',
    'expense',
    'ASSET',
    1,
    ['asset'],
  ])('rejects %j with the ledger type field error', (type) => {
    const result = getLedgerBalancesByCurrencyQueryValidationSchema.safeParse({
      type,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual([
      expect.objectContaining({
        path: ['type'],
        message: new ledgerAccountError.InvalidType().errorKey,
      }),
    ]);
  });
});
