import journalLineEntity from '@domain/journal-entry/entities/journal-line.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import { TDraftJournalLinePatch } from '@domain/journal-entry/types/journal-entry.service.types';
import { IJournalEntry } from '@domain/journal-entry/types/journal-entry.types';
import {
  IJournalLine,
  UJournalSide,
} from '@domain/journal-entry/types/journal-line.types';
import { ICurrency } from '@domain/money/types/currency.types';

import patchDraftJournalLineHelper from './patch-draft-journal-line.helper';

interface IReplaceDraftJournalLinesPayload {
  originalLines: IJournalLine[];
  requestedLines: TDraftJournalLinePatch[];
  header: Pick<IJournalEntry, 'id' | 'createdBy' | 'createdAt' | 'memo'>;
  functionalCurrency: ICurrency;
  side: UJournalSide;
}

/** Prepares a replacement line set and validates retained IDs and additions. */
export default function replaceDraftJournalLinesHelper({
  originalLines,
  requestedLines,
  header,
  functionalCurrency,
  side,
}: IReplaceDraftJournalLinesPayload): IJournalLine[] {
  const originalLinesById = new Map(
    originalLines.map((line) => [line.id, line])
  );
  const retainedIds = new Set<IJournalLine['id']>();

  return requestedLines.map((patch) => {
    if (patch.id !== undefined) {
      const original = originalLinesById.get(patch.id);
      const hasInvalidId = !original || retainedIds.has(patch.id);
      if (hasInvalidId) {
        throw new journalEntryError.RectificationLineId({ id: patch.id });
      }

      retainedIds.add(patch.id);
      return patchDraftJournalLineHelper(original, patch);
    }

    const { accountId, amount, sequenceOrder } = patch;
    const isIncomplete =
      accountId === undefined ||
      amount === undefined ||
      sequenceOrder === undefined;
    if (isIncomplete) {
      throw new journalEntryError.InvalidJournalLineItem();
    }

    const [line] = journalLineEntity.make(header, {
      accountId,
      amount,
      sequenceOrder,
      counterpartyId: patch.counterpartyId,
      description: patch.description ?? null,
      exchangeRate: patch.exchangeRate ?? null,
      functionalCurrency,
      side,
    });

    return line;
  });
}
