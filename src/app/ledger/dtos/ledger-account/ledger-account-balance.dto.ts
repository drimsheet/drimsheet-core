import { ILedgerAccountBalance } from '@domain/ledger/types/ledger-account-balance.types';

import { IMoneyDto } from '@app/money/dtos/money/money.dto';

export interface ILedgerAccountBalanceDto extends Omit<
  ILedgerAccountBalance,
  'amount' | 'functionalAmount'
> {
  amount: IMoneyDto;
  functionalAmount: IMoneyDto;
}
