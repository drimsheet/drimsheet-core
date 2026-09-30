import z from 'zod';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import { ERevenueAccountBehavior } from '@domain/ledger/types/revenue-account.types';

export const createRevenueAccountValidation = z
  .object({
    name: z
      .string()
      .min(2, new ledgerAccountError.InvalidName().errorKey)
      .max(100, new ledgerAccountError.InvalidName().errorKey),
    isControlAccount: z.boolean(),
    controlAccountId: z
      .uuid(new ledgerAccountError.InvalidControlAccountId().errorKey)
      .optional(),
    behavior: z.enum(
      [
        ERevenueAccountBehavior.Services,
        ERevenueAccountBehavior.EmploymentIncome,
        ERevenueAccountBehavior.GainOnAssetSale,
        ERevenueAccountBehavior.UnrealizedGains,
        ERevenueAccountBehavior.Grants,
        ERevenueAccountBehavior.Gifts,
      ],
      new ledgerAccountError.InvalidBehavior().errorKey
    ),
  })
  .strict();
