import z from 'zod';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import { ELedgerType, ULedgerType } from '@domain/ledger/types/ledger.types';

import { IMoneyDto } from '@app/money/dtos/money/money.dto';

export interface IGetTotalBalanceByTypeQuery {
  type: ULedgerType;
}

export interface ITotalBalanceByTypeDto {
  totalFunctionalBalance: IMoneyDto;
}

export const getTotalBalanceByTypeQueryValidationSchema = z.object({
  type: z.enum(ELedgerType, new ledgerAccountError.InvalidType().errorKey),
});
