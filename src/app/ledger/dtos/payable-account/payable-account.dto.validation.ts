import z from 'zod';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';

import { ledgerAccountCreationStatusValidation } from '@app/ledger/dtos/ledger-account/ledger-account.dto.validation';
import { currencyCodeValidation } from '@app/money/dtos/currency/currency.dto.validation';

export const createTradePayableAccountValidation = z
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
    meta: z
      .object({
        counterpartyId: z.uuid(
          new ledgerAccountError.InvalidCounterpartyId().errorKey
        ),
        invoiceId: z.uuid(new ledgerAccountError.InvalidInvoiceId().errorKey),
      })
      .strict()
      .nullable()
      .optional(),
  })
  .strict();

export const createStatutoryPayableAccountValidation = z
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
    meta: z
      .object({
        taxAuthority: z.string(
          new ledgerAccountError.InvalidTaxAuthority().errorKey
        ),
        taxType: z.string(new ledgerAccountError.InvalidTaxType().errorKey),
      })
      .strict()
      .nullable()
      .optional(),
  })
  .strict();
