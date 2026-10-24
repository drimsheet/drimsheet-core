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
