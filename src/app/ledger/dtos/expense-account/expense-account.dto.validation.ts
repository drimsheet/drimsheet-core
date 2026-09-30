import z from 'zod';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import { EExpenseAccountBehavior } from '@domain/ledger/types/expense-account.types';

export const createExpenseAccountValidation = z
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
        EExpenseAccountBehavior.DefaultDirectCost,
        EExpenseAccountBehavior.COGS,
        EExpenseAccountBehavior.CostOfServices,
        EExpenseAccountBehavior.CostOfRevenue,
        EExpenseAccountBehavior.RentAndUtilities,
        EExpenseAccountBehavior.BankCharge,
        EExpenseAccountBehavior.FinanceCost,
        EExpenseAccountBehavior.Interest,
        EExpenseAccountBehavior.TaxExpense,
        EExpenseAccountBehavior.UnrealizedLoss,
        EExpenseAccountBehavior.AssetDisposalLoss,
      ],
      new ledgerAccountError.InvalidBehavior().errorKey
    ),
  })
  .strict();
