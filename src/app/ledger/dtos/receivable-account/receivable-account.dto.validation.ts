import z from 'zod';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';

import { ledgerAccountCreationStatusValidation } from '@app/ledger/dtos/ledger-account/ledger-account.dto.validation';
import { currencyCodeValidation } from '@app/money/dtos/currency/currency.dto.validation';

export const createTradeReceivableAccountValidation = z
  .object({
    status: ledgerAccountCreationStatusValidation.optional(),
    name: z
      .string()
      .min(2, new ledgerAccountError.InvalidName().errorKey)
      .max(100, new ledgerAccountError.InvalidName().errorKey),
    isControlAccount: z.boolean(),
    controlAccountId: z
      .uuid(new ledgerAccountError.InvalidControlAccountId().errorKey)
      .optional(),
    currencyCode: currencyCodeValidation,
  })
  .strict();

export const createStatutoryReceivableAccountValidation = z
  .object({
    status: ledgerAccountCreationStatusValidation.optional(),
    name: z
      .string()
      .min(2, new ledgerAccountError.InvalidName().errorKey)
      .max(100, new ledgerAccountError.InvalidName().errorKey),
    isControlAccount: z.boolean(),
    controlAccountId: z
      .uuid(new ledgerAccountError.InvalidControlAccountId().errorKey)
      .optional(),
    currencyCode: currencyCodeValidation,
  })
  .strict();
