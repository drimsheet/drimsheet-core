import {
  IReadRepoOptions,
  ITransactionContext,
} from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import { IEvent } from '@shared/values/events/types/event.types';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { TAuditedJournalEntry } from '@domain/journal-entry/types/journal-entry-audit.types';
import { IJournalEntryRectificationUpdate } from '@domain/journal-entry/types/journal-entry-rectification.types';
import { IJournalEntry } from '@domain/journal-entry/types/journal-entry.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { IExchangeRate } from '@domain/money/types/exchange-rate.types';
import { IMoney } from '@domain/money/types/money.types';

import { IOpeningBalanceDto } from '@app/journal-entry/dtos/opening-balance/opening-balance.dto';
import { TFxLotAcquisitionAppResult } from '@app/subledger/fx-cost-basis/types/fx-lot.service.types';

export interface IInitialOpeningBalancePayload {
  accountingEntityId: TEntityId;
  functionalCurrencyCode: string;
  account: ILedgerAccount;
  amount: IMoney;
  effectiveDate: Date;
  exchangeRate: IExchangeRate | null;
  createdBy: TEntityId;
}

export interface IOpeningBalanceEntryPayload {
  account: ILedgerAccount;
  openingBalance: IOpeningBalanceDto;
  accountingEntity: IAccountingEntity;
  actor: TEntityId;
}

export interface IOpeningBalanceJournalMutation {
  entriesToCreate: TAuditedJournalEntry[];
  entryUpdate: IJournalEntryRectificationUpdate | null;
  events: IEvent<unknown>[];
}

interface IOpeningBalanceEntryEffects {
  fxAcquisition: TFxLotAcquisitionAppResult | null;
  entriesForBalancePropagation: IJournalEntry[];
}

export interface IOpeningBalanceEntryCreationResult extends IOpeningBalanceEntryEffects {
  creation: TAuditedJournalEntry;
}

export interface IOpeningBalanceEntryMutationResult extends IOpeningBalanceEntryEffects {
  mutation: IOpeningBalanceJournalMutation;
  currentJournalEntry: IJournalEntry;
}

export default interface IOpeningBalanceEntryAppService {
  /**
   * Creates the journal for a new, unpersisted account whose opening date is
   * already set. Requires the caller's transaction for the account-existence
   * and posting-period reads. Rejects a missing transaction, an existing account,
   * a mismatched date, invalid journal accounts or a closed posting period.
   * Returns the journal, domain events and audit; performs no writes or FX work.
   */
  createInitialOpeningBalance(
    payload: IInitialOpeningBalancePayload,
    repoOptions: IReadRepoOptions & { tx: ITransactionContext }
  ): Promise<TAuditedJournalEntry>;

  /**
   * Creates a new opening journal against the configured opening-balance equity
   * account. Rejects an existing opening date or balance adjustments, invalid
   * account/currency state, missing equity configuration, and read/FX failures.
   * Draft accounts produce draft journals; active accounts produce posted ones.
   * Returns the audited journal, optional FX acquisition, and posted entries
   * requiring balance propagation. Does not persist, publish or enqueue work.
   */
  create(
    payload: IOpeningBalanceEntryPayload,
    repoOptions: IReadRepoOptions
  ): Promise<IOpeningBalanceEntryCreationResult>;

  /**
   * Creates or revises the account's draft opening journal. Historical posted
   * activity locks the balance and rejects the request. Revisions retain entry
   * and line identities and validate the posting period. Domain, read and FX
   * failures propagate. The updating use case supplies the transaction holding
   * its account lock so these reads share that context.
   * Returns audited journal mutations, optional FX acquisition, and propagation
   * candidates. The caller owns all persistence, publication and queueing.
   */
  createOrRevise(
    payload: IOpeningBalanceEntryPayload,
    repoOptions: IReadRepoOptions
  ): Promise<IOpeningBalanceEntryMutationResult>;
}
