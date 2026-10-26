import z from 'zod';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';

import { getFiscalYearParamsValidationSchema } from '@app/accounting/dtos/fiscal-year/fiscal-year.dto.validation';
import {
  dateRangeValidationSchema,
  IDateRangeDto,
} from '@app/ledger/usecases/reporting/shared/date-range';
import { IMoneyDto } from '@app/money/dtos/money/money.dto';

export interface IGetLedgerTotalDebitsAndCreditsByCurrencyQuery {
  fiscalYearId: string;
  /** Equity accounts are not supported by this report. */
  type: 'asset' | 'liability' | 'revenue' | 'expense';
  /** Inclusive YYYY-MM-DD date; defaults to the fiscal year's start. */
  startDate?: string;
  /** Inclusive YYYY-MM-DD date; defaults to min(today UTC, fiscal year end). */
  endDate?: string;
}

export interface ILedgerTotalDebitsAndCreditsByCurrencyDto {
  fiscalYearId: string;
  period: IDateRangeDto;
  /** Original-currency totals, sorted by currency code; empty without activity. */
  totalsByCurrency: {
    totalDebits: IMoneyDto;
    totalCredits: IMoneyDto;
  }[];
}

export const getLedgerTotalDebitsAndCreditsByCurrencyQueryValidationSchema =
  z.object({
    fiscalYearId: getFiscalYearParamsValidationSchema.shape.id,
    type: z.enum(
      ['asset', 'liability', 'revenue', 'expense'],
      new ledgerAccountError.InvalidType().errorKey
    ),
    startDate: dateRangeValidationSchema.shape.from.optional(),
    endDate: dateRangeValidationSchema.shape.to.optional(),
  });
