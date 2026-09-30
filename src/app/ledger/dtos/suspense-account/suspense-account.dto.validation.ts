import z from 'zod';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';

import { currencyCodeValidation } from '@app/money/dtos/currency/currency.dto.validation';

export const createSuspenseAccountValidation = z
  .object({
    name: z
      .string()
      .min(2, new ledgerAccountError.InvalidName().errorKey)
      .max(100, new ledgerAccountError.InvalidName().errorKey),
    type: z.enum(
      ['asset', 'liability'],
      new ledgerAccountError.InvalidType().errorKey
    ),
    currencyCode: currencyCodeValidation,
  })
  .strict();
