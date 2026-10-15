import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { ICounterparty } from '@domain/counterparty/types/counterparty.types';
import { UNormalBalance } from '@domain/ledger/types/ledger.types';
import { UCurrencyCode } from '@domain/money/config/currencies.config';

export interface IAccountCounterpartyParticipationAggregate {
  counterparty: ICounterparty | null;
  isSelf: boolean;
  normalBalance: UNormalBalance;
  debits: bigint;
  credits: bigint;
  functionalDebits: bigint;
  functionalCredits: bigint;
}

/**
 * Reads applied journal contributions for an account and its descendants through
 * their balance adjustments. Each line is counted once, excluding drafts,
 * never-posted entries, voided originals and reversals. Archived records and
 * opening balances remain eligible. Amounts use the requested account's currency
 * or functional currency when unset. Groups by counterparty, self and the posting
 * account's normal balance, ordered by counterparty name/ID then self and side.
 */
export default interface IAccountCounterpartyParticipationQueryRepo {
  aggregateByAccount(
    criteria: {
      accountId: TEntityId;
      accountingEntityId: TEntityId;
      functionalCurrencyCode: UCurrencyCode;
    },
    options: IReadRepoOptions
  ): Promise<IAccountCounterpartyParticipationAggregate[]>;
}
