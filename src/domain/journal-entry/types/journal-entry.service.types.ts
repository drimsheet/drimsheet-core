import { TEntityId } from '@shared/types/uuid';

import { ICounterparty } from '@domain/counterparty/types/counterparty.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { IExchangeRate } from '@domain/money/types/exchange-rate.types';
import { IMoney } from '@domain/money/types/money.types';

import { IJournalLine, IJournalLineMeta } from './journal-line.types';

export interface IJournalEntryHeaderPayload {
  accountingEntityId: TEntityId;
  memo: string | null;
  effectiveDate: Date;
  postedAt: Date | null;
  functionalCurrencyCode: string;
  createdBy: TEntityId;
}

export interface IJournalEntryBaseLinePayload {
  account: ILedgerAccount;
  sequenceOrder: number;
  amount: IMoney;
  exchangeRate: IExchangeRate | null;
  description: string | null;
  meta: IJournalLineMeta | null;
}

export interface IJournalEntryLinePayload extends IJournalEntryBaseLinePayload {
  counterparty: ICounterparty | null;
}

export type TDraftJournalLinePatch = Partial<
  Pick<
    IJournalLine,
    | 'id'
    | 'accountId'
    | 'counterpartyId'
    | 'sequenceOrder'
    | 'amount'
    | 'exchangeRate'
    | 'description'
  >
>;
