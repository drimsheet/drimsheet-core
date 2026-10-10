import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { IJournalEntryRectificationResult } from '@domain/journal-entry/types/journal-entry-rectification.types';
import { IJournalEntry } from '@domain/journal-entry/types/journal-entry.types';

import { ICounterpartyFindOrCreateRes } from '@app/counterparty/contracts/counterparty.service.contract';
import { TJournalEntryRectificationReq } from '@app/journal-entry/dtos/journal-entry-rectification/journal-entry-rectification.dto';
import {
  TFxLotAcquisitionAppResult,
  TFxLotDispositionAppResult,
  TFxLotReversalAppResult,
} from '@app/subledger/fx-cost-basis/types/fx-lot.service.types';

export interface IJournalEntryRectificationPreparationPayload {
  originalEntry: IJournalEntry;
  requestedEntry: TJournalEntryRectificationReq;
  accountingEntity: IAccountingEntity;
  actor: TEntityId;
}

export interface IPreparedJournalEntryRectification {
  rectification: IJournalEntryRectificationResult;
  counterparties: Map<string, ICounterpartyFindOrCreateRes>;
  fxReversal: TFxLotReversalAppResult | null;
  fxDisposition: TFxLotDispositionAppResult | null;
  fxAcquisition: TFxLotAcquisitionAppResult | null;
}

export default interface IJournalEntryRectificationPreparationAppService {
  /**
   * Prepares the source-specific journal entry, domain rectification, and any
   * required FX-lot reversal and corrected effects. Failures reject and no
   * writes or event publication are initiated.
   */
  prepare(
    payload: IJournalEntryRectificationPreparationPayload,
    repoOptions: IReadRepoOptions
  ): Promise<IPreparedJournalEntryRectification>;
}
