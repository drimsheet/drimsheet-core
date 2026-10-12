import { IMoney } from '@domain/money/types/money.types';

export interface IAccountCashFlowReport {
  period: { from: string; to: string };
  totalMoneyIn: IMoney;
  totalMoneyOut: IMoney;
  buckets: {
    from: string;
    to: string;
    moneyIn: IMoney;
    moneyOut: IMoney;
  }[];
}
