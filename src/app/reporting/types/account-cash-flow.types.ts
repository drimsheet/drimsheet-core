import { IDateRange } from '@shared/types/date.types';

import { IMoney } from '@domain/money/types/money.types';

interface IAccountCashFlowBucket extends IDateRange {
  moneyIn: IMoney;
  moneyOut: IMoney;
}

export interface IAccountCashFlowReport {
  period: IDateRange;
  totalMoneyIn: IMoney;
  totalMoneyOut: IMoney;
  buckets: IAccountCashFlowBucket[];
}
