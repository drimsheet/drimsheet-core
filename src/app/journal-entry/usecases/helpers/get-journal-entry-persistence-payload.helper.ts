import { TEntityId } from '@shared/types/uuid';
import historyValue from '@shared/values/history/history.vo';

import { TAuditedJournalEntry } from '@domain/journal-entry/types/journal-entry-audit.types';
import { IJournalEntryRectificationUpdate } from '@domain/journal-entry/types/journal-entry-rectification.types';

import { IJournalEntryRectificationPersistencePayload } from '@app/journal-entry/contracts/journal-entry-persistence.service.contract';

interface IJournalEntryPersistencePreparation {
  entriesToCreate: TAuditedJournalEntry[];
  entryUpdate: IJournalEntryRectificationUpdate | null;
}

/**
 * Adds actor and correlation history metadata to a prepared journal-entry
 * persistence bundle without changing the prepared accounting state.
 */
export default function getJournalEntryPersistencePayloadHelper(
  preparation: IJournalEntryPersistencePreparation,
  actor: TEntityId,
  correlationId: string
): IJournalEntryRectificationPersistencePayload {
  const entriesToCreate = preparation.entriesToCreate.map(
    ([entry, , audit]) => ({
      entry,
      headerHistory: historyValue.make(audit.header, actor, correlationId),
      lineHistories: audit.lines.map((lineAudit) =>
        historyValue.make(lineAudit, actor, correlationId)
      ),
    })
  );

  const entryUpdate = preparation.entryUpdate
    ? {
        entry: preparation.entryUpdate.entry,
        expectedVersion: preparation.entryUpdate.expectedVersion,
        headerHistory: historyValue.make(
          preparation.entryUpdate.headerAudit,
          actor,
          correlationId
        ),
        lineHistories: preparation.entryUpdate.lineAudits.map((lineAudit) =>
          historyValue.make(lineAudit, actor, correlationId)
        ),
        linesToCreate: preparation.entryUpdate.linesToCreate,
        linesToUpdate: preparation.entryUpdate.linesToUpdate,
        lineIdsToDelete: preparation.entryUpdate.lineIdsToDelete,
      }
    : null;

  return { entriesToCreate, entryUpdate };
}
