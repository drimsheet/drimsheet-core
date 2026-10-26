import z from 'zod';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';

const invalidCodeKey = new ledgerAccountError.InvalidCode().errorKey;

export const getLedgerAccountBalanceQueryValidationSchema = z.object({
  code: z.string(invalidCodeKey).regex(/^[1-5][0-9]{5}$/, invalidCodeKey),
});
