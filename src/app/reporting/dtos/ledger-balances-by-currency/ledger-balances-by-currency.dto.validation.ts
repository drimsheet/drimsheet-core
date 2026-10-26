import z from 'zod';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';

export const getLedgerBalancesByCurrencyQueryValidationSchema = z.object({
  type: z.enum(
    ['asset', 'liability'],
    new ledgerAccountError.InvalidType().errorKey
  ),
});
