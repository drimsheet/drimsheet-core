import { TEntityId } from '@shared/types/uuid';

import { IJournalEntry } from '@domain/journal-entry/types/journal-entry.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { IMoney } from '@domain/money/types/money.types';

export interface ILedgerAccountBalanceDelta {
  ledgerAccountId: TEntityId;
  amount: IMoney;
  functionalAmount: IMoney;
}

export default interface ILedgerAccountBalanceAdjustmentService {
  forJournal(journalEntry: IJournalEntry): {
    directAccountIds: TEntityId[];
    calculate(accounts: ILedgerAccount[]): ILedgerAccountBalanceDelta[];
  };
}
