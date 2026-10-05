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

export const EJournalEntryRectificationMode = {
  UpdateDraft: 'update_draft',
  UpdateMeta: 'update_meta',
  VoidAndReplace: 'void_and_replace',
} as const;

export type UJournalEntryRectificationMode =
  (typeof EJournalEntryRectificationMode)[keyof typeof EJournalEntryRectificationMode];

export interface IJournalEntryRectificationPayload {
  actorId: TEntityId;
  originalEntry: IJournalEntry;
  newEntry: Partial<IJournalEntry> & { id: TEntityId };
}

export interface IJournalEntryRectificationUpdate {
  entry: IJournalEntry;
  expectedVersion: number;
  headerAudit: IJournalEntryAudit | IJournalEntryRectificationAudit;
  lineAudits: IJournalLineAudit[];
  linesToCreate: IJournalLine[];
  linesToUpdate: IJournalLine[];
  lineIdsToDelete: TEntityId[];
}

export interface IJournalEntryRectificationResult {
  mode: UJournalEntryRectificationMode;
  originalJournalEntryId: TEntityId;
  currentJournalEntry: IJournalEntry;
  reversingJournalEntry: IJournalEntry | null;
  entriesToCreate: TAuditedJournalEntry[];
  entryUpdate: IJournalEntryRectificationUpdate | null;
  events: IEvent<unknown>[];
}

export interface IJournalEntryReversalResult {
  originalJournalEntryId: TEntityId;
  reversingJournalEntry: IJournalEntry;
  entriesToCreate: TAuditedJournalEntry[];
  entryUpdate: IJournalEntryRectificationUpdate;
  events: IEvent<unknown>[];
}

export interface IJournalEntryRectificationService {
  rectify(
    payload: IJournalEntryRectificationPayload,
    repoOptions: IReadRepoOptions
  ): Promise<IJournalEntryRectificationResult>;

  reverse(
    originalEntry: IJournalEntry,
    actorId: TEntityId,
    repoOptions: IReadRepoOptions
  ): Promise<IJournalEntryReversalResult>;
}
