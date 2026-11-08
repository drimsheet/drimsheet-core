import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { IJournalEntryRectificationResult } from '@domain/journal-entry/types/journal-entry-rectification.types';
import { IJournalEntry } from '@domain/journal-entry/types/journal-entry.types';
import {
  IFxCostBasisAcquisitionResult,
  IFxCostBasisDispositionResult,
  IFxCostBasisReversalResult,
} from '@domain/subledger/fx-cost-basis/types/lot.service.types';

import { TJournalEntryRectificationReq } from '@app/journal-entry/dtos/journal-entry-rectification/journal-entry-rectification.dto';

export interface IJournalEntryRectificationPreparationPayload {
  originalEntry: IJournalEntry;
  requestedEntry: TJournalEntryRectificationReq;
  accountingEntity: IAccountingEntity;
  actor: TEntityId;
}

export interface IPreparedJournalEntryRectification {
  rectification: IJournalEntryRectificationResult;
  fxReversal: IFxCostBasisReversalResult | null;
  fxDisposition: IFxCostBasisDispositionResult | null;
  fxAcquisition: IFxCostBasisAcquisitionResult | null;
}

// TODO: check the usefulness of this service. Could it be a simple helper?
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
