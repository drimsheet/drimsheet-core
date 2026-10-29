import { ICounterparty } from '@domain/counterparty/types/counterparty.types';
import { IMoney } from '@domain/money/types/money.types';

export interface IAccountBalanceContributionsByCounterparty {
  counterparty: ICounterparty | null;
  isSelf: boolean;
  amount: IMoney;
  functionalAmount: IMoney;
  totalShare: number | null;
}
