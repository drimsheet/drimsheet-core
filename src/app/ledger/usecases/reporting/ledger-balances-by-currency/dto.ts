import z from 'zod';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';

import { IMoneyDto } from '@app/money/dtos/money/money.dto';

export interface IGetLedgerBalancesByCurrencyQuery {
  type: 'asset' | 'liability';
}

export interface ILedgerBalancesByCurrencyDto {
  /** Sum of the currency groups' recorded functional balances. */
  totalFunctionalBalance: IMoneyDto;
  /** Current posting-account balances, ordered by currency code. */
  balancesByCurrency: {
    balance: IMoneyDto;
    functionalBalance: IMoneyDto;
  }[];
}

export const getLedgerBalancesByCurrencyQueryValidationSchema = z.object({
  type: z.enum(
    ['asset', 'liability'],
    new ledgerAccountError.InvalidType().errorKey
  ),
});
