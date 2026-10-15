import { IEvent } from '@shared/values/events/types/event.types';
import {
  IEntityDelta,
  IHistory,
} from '@shared/values/history/types/history.types';

import { IJournalEntry, IJournalHeader } from './journal-entry.types';
import { IJournalLine } from './journal-line.types';

export const EJournalEntryAuditAction = {
  Created: 'created',
  Updated: 'updated',
  Voided: 'voided',
  Posted: 'posted',
  Archived: 'archived',
  UnArchived: 'un-archived',
} as const;

export type UJournalEntryAuditAction =
  (typeof EJournalEntryAuditAction)[keyof typeof EJournalEntryAuditAction];

export interface IJournalEntryAudit<
  TJournalEntry extends IJournalHeader = IJournalHeader,
> extends IEntityDelta<TJournalEntry> {
  action: UJournalEntryAuditAction;
}

export type IJournalEntryRectificationAudit = IJournalEntryAudit<IJournalEntry>;

export interface IMakeJournalEntryAuditPayload<
  TJournalEntry extends IJournalHeader = IJournalHeader,
> {
  before: TJournalEntry | null;
  after: TJournalEntry;
  action: UJournalEntryAuditAction;
}

export type IMakeJournalEntryRectificationAuditPayload =
  IMakeJournalEntryAuditPayload<IJournalEntry>;

export interface IJournalEntryHistory extends IHistory<IJournalHeader> {}

export interface IJournalEntryRectificationHistory extends IHistory<IJournalEntry> {}

export const EJournalLineAuditAction = {
  Created: 'created',
  Updated: 'updated',
  Deleted: 'deleted',
} as const;

export type UJournalLineAuditAction =
  (typeof EJournalLineAuditAction)[keyof typeof EJournalLineAuditAction];

export interface IJournalLineAudit extends IEntityDelta<IJournalLine> {
  action: UJournalLineAuditAction;
}

export interface IMakeJournalLineAuditPayload {
  before: IJournalLine | null;
  after: IJournalLine;
  action: UJournalLineAuditAction;
}

export interface IJournalLineHistory extends IHistory<IJournalLine> {}

export type TAuditedJournalEntry = [
  IJournalEntry,
  IEvent<IJournalEntry | IJournalLine>[],
  {
    header: IJournalEntryAudit;
    lines: IJournalLineAudit[];
  },
];

export type TAuditedJournalEntryTransition = [
  IJournalEntry,
  IEvent<IJournalEntry>[],
  IJournalEntryAudit | null,
];

export type TAuditedJournalEntryUpdate = [
  IJournalEntry,
  IEvent<IJournalEntry | IJournalLine>[],
  {
    header: IJournalEntryRectificationAudit;
    lines: IJournalLineAudit[];
  } | null,
];
