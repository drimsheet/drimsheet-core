import z from 'zod';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import { EExpenseAccountBehavior } from '@domain/ledger/types/expense-account.types';

import { ledgerAccountCreationStatusValidation } from '@app/ledger/dtos/ledger-account/ledger-account.dto.validation';

export const createExpenseAccountValidation = z
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
