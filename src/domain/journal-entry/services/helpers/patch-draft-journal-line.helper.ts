import generateDiff from '@shared/utils/diff-generator';

import { TDraftJournalLinePatch } from '@domain/journal-entry/types/journal-entry.service.types';
import { IJournalLine } from '@domain/journal-entry/types/journal-line.types';

/** Merges supplied fields and keeps the stored timestamp of an equivalent rate. */
export default function patchDraftJournalLineHelper(
  line: IJournalLine,
  patch: TDraftJournalLinePatch
): IJournalLine {
  const exchangeRate = patch.exchangeRate;
  const { createdAt: _requestedAt, ...requestedRate } = exchangeRate ?? {};
  const { createdAt: _storedAt, ...storedRate } = line.exchangeRate ?? {};
  const replacesRate =
    exchangeRate !== undefined &&
    generateDiff(requestedRate, storedRate).hasChanges;

  return {
    ...line,
    accountId: patch.accountId ?? line.accountId,
    counterpartyId:
      patch.counterpartyId === undefined
        ? line.counterpartyId
        : patch.counterpartyId,
    sequenceOrder: patch.sequenceOrder ?? line.sequenceOrder,
    amount: patch.amount ?? line.amount,
    exchangeRate: replacesRate ? exchangeRate : line.exchangeRate,
    description:
      patch.description === undefined ? line.description : patch.description,
  };
}
