import z from 'zod';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';

import {
  openingBalanceDtoValidation,
  openingBalanceJsonDtoValidation,
} from '@app/journal-entry/dtos/opening-balance/opening-balance.dto.validation';
import { ledgerAccountCreationStatusValidation } from '@app/ledger/dtos/ledger-account/ledger-account.dto.validation';
import { currencyCodeValidation } from '@app/money/dtos/currency/currency.dto.validation';

export const pettyCashCreationReqValidation = z
  .object({
    status: ledgerAccountCreationStatusValidation.optional(),
    name: z
      .string()
      .min(1, new ledgerAccountError.InvalidName().errorKey)
      .max(100, new ledgerAccountError.InvalidName().errorKey),
    currencyCode: currencyCodeValidation,
    isControlAccount: z.boolean(),
    controlAccountId: z
      .uuid(new ledgerAccountError.InvalidControlAccountId().errorKey)
      .optional(),

    openingBalance: openingBalanceDtoValidation.nullable(),
  })
  .refine(
    (data) => {
      if (data.openingBalance) {
        return data.openingBalance.amount.currencyCode === data.currencyCode;
      }
      return true;
    },
    {
      message: new ledgerAccountError.OpeningBalanceCurrencyMismatch().errorKey,
      path: ['openingBalance', 'amount', 'currencyCode'],
    }
  );

export const pettyCashUpdateReqValidation = z
  .strictObject({
    name: z
      .string()
      .min(1, new ledgerAccountError.InvalidName().errorKey)
      .max(100, new ledgerAccountError.InvalidName().errorKey)
      .optional(),
    openingBalance: openingBalanceDtoValidation.optional(),
  })
  .refine(
    (payload) =>
      payload.name !== undefined || payload.openingBalance !== undefined,
    new ledgerAccountError.InvalidUpdate().errorKey
  );

export const bankDetailsCreationReqValidation = z
  .object({
    bankName: z
      .string()
      .min(2, new ledgerAccountError.InvalidBankName().errorKey)
      .max(100, new ledgerAccountError.InvalidBankName().errorKey),
    accountName: z
      .string()
      .min(2, new ledgerAccountError.InvalidBankAccountName().errorKey)
      .max(100, new ledgerAccountError.InvalidBankAccountName().errorKey),
    accountNumber: z
      .string()
      .min(6, new ledgerAccountError.InvalidBankAccountNumber().errorKey)
      .max(34, new ledgerAccountError.InvalidBankAccountNumber().errorKey),
  })
  .strict();

export const bankAccountCreationReqValidation = z
  .object({
    status: ledgerAccountCreationStatusValidation.optional(),
    name: z
      .string()
      .min(1, new ledgerAccountError.InvalidName().errorKey)
      .max(100, new ledgerAccountError.InvalidName().errorKey),
    currencyCode: currencyCodeValidation,
    controlAccountId: z
      .uuid(new ledgerAccountError.InvalidControlAccountId().errorKey)
      .optional(),
    bankAccount: bankDetailsCreationReqValidation,
    openingBalance: openingBalanceDtoValidation.nullable(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.openingBalance) {
        return data.openingBalance.amount.currencyCode === data.currencyCode;
      }
      return true;
    },
    {
      message: new ledgerAccountError.OpeningBalanceCurrencyMismatch().errorKey,
      path: ['openingBalance', 'amount', 'currencyCode'],
    }
  );

export const bankAccountCreationJsonReqValidation = z
  .strictObject({
    ...bankAccountCreationReqValidation.shape,
    openingBalance: openingBalanceJsonDtoValidation.nullable(),
  })
  .superRefine((input, ctx) => {
    const validated = bankAccountCreationReqValidation.safeParse(input);
    if (!validated.success) {
      for (const issue of validated.error.issues) {
        ctx.addIssue({
          code: 'custom',
          message: issue.message,
          path: issue.path,
        });
      }
    }
  });

export const pettyCashCreationJsonReqValidation = z
  .object({
    ...pettyCashCreationReqValidation.shape,
    openingBalance: openingBalanceJsonDtoValidation.nullable(),
  })
  .superRefine((input, ctx) => {
    const validated = pettyCashCreationReqValidation.safeParse(input);
    if (!validated.success) {
      for (const issue of validated.error.issues) {
        ctx.addIssue({
          code: 'custom',
          message: issue.message,
          path: issue.path,
        });
      }
    }
  });
