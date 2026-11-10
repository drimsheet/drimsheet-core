import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import { IEvent } from '@shared/values/events/types/event.types';

import {
  IJournalEntryAudit,
  IJournalEntryRectificationAudit,
  IJournalLineAudit,
  TAuditedJournalEntry,
} from '@domain/journal-entry/types/journal-entry-audit.types';
import { IJournalEntry } from '@domain/journal-entry/types/journal-entry.types';
import { IJournalLine } from '@domain/journal-entry/types/journal-line.types';

export interface IJournalEntryRectificationUpdate {
  entry: IJournalEntry;
  expectedVersion: number;
  headerAudit: IJournalEntryAudit | IJournalEntryRectificationAudit;
  lineAudits: IJournalLineAudit[];
  linesToCreate: IJournalLine[];
  linesToUpdate: IJournalLine[];
  lineIdsToDelete: TEntityId[];
}

export interface IJournalEntryReversalResult {
  originalJournalEntryId: TEntityId;
  reversingJournalEntry: IJournalEntry;
  entriesToCreate: TAuditedJournalEntry[];
  entryUpdate: IJournalEntryRectificationUpdate | null;
  events: IEvent<unknown>[];
}

export interface IJournalEntryRectificationService {
  /** Prepares a reversal on the original effective date in an open period. */
  reverse(
    originalEntry: IJournalEntry,
    actorId: TEntityId,
    repoOptions: IReadRepoOptions
  ): Promise<IJournalEntryReversalResult>;
}
