import { TEntityId } from '@shared/types/uuid';

import {
  IJournalEntryAudit,
  IJournalEntryRectificationAudit,
  IJournalLineAudit,
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
