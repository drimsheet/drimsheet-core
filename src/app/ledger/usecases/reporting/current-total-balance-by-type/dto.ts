import z from 'zod';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import { ELedgerType, ULedgerType } from '@domain/ledger/types/ledger.types';

import { IMoneyDto } from '@app/money/dtos/money/money.dto';

export interface IGetCurrentTotalBalanceByTypeQuery {
  type: ULedgerType;
}

export interface ICurrentTotalBalanceByTypeDto {
  totalFunctionalBalance: IMoneyDto;
}

export const getCurrentTotalBalanceByTypeQueryValidationSchema = z.object({
  type: z.enum(ELedgerType, new ledgerAccountError.InvalidType().errorKey),
});
