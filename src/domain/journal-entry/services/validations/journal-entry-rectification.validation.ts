import { isEqual } from 'lodash';

import stringUtils from '@shared/utils/string';

import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import { IJournalEntryRectificationPayload } from '@domain/journal-entry/types/journal-entry-rectification.types';
import { EJournalEntryStatus } from '@domain/journal-entry/types/journal-entry.types';

function validatePayload(payload: IJournalEntryRectificationPayload) {
  const { originalEntry, newEntry } = payload;
  const isRectifiable =
    originalEntry.status === EJournalEntryStatus.Draft ||
    originalEntry.status === EJournalEntryStatus.Posted;

  if (!isRectifiable) {
    throw new journalEntryError.RectificationNotPermitted({
      status: originalEntry.status,
    });
  }

  stringUtils.validateUUID(newEntry.id, journalEntryError.InvalidJournalEntry);

  if (newEntry.lines) {
    for (const line of newEntry.lines) {
      stringUtils.validateUUID(line.id, journalEntryError.RectificationLineId);
    }

    const lineIds = newEntry.lines.map((line) => line.id);
    const hasDuplicateLineIds = new Set(lineIds).size !== lineIds.length;

    if (hasDuplicateLineIds) {
      throw new journalEntryError.RectificationLineId();
    }
  }

  const changesOwner =
    (newEntry.accountingEntityId !== undefined &&
      newEntry.accountingEntityId !== originalEntry.accountingEntityId) ||
    (newEntry.sourceType !== undefined &&
      newEntry.sourceType !== originalEntry.sourceType) ||
    (newEntry.createdBy !== undefined &&
      !isEqual(newEntry.createdBy, originalEntry.createdBy));

  if (changesOwner) {
    throw new journalEntryError.RectificationNotPermitted();
  }
}

const journalEntryRectificationValidation = Object.freeze({
  validatePayload,
});

export default journalEntryRectificationValidation;
