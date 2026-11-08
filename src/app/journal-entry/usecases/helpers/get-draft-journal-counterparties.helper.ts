import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import ICounterpartyRepo from '@domain/counterparty/repos/counterparty.repo';
import { TDraftJournalLinePatch } from '@domain/journal-entry/types/journal-entry.service.types';
import { IJournalLine } from '@domain/journal-entry/types/journal-line.types';

interface IGetDraftJournalCounterpartiesPayload {
  accountingEntityId: TEntityId;
  storedLines: readonly Pick<IJournalLine, 'counterpartyId'>[];
  requestedLines: readonly Pick<TDraftJournalLinePatch, 'counterpartyId'>[];
  repo: ICounterpartyRepo;
  repoOptions: IReadRepoOptions;
}

/**
 * Fetches distinct non-null references. The domain checks which counterparties
 * must resolve after applying the patch.
 */
export default function getDraftJournalCounterpartiesHelper({
  accountingEntityId,
  storedLines,
  requestedLines,
  repo,
  repoOptions,
}: IGetDraftJournalCounterpartiesPayload) {
  const counterpartyIds = [
    ...new Set([
      ...storedLines.flatMap((line) =>
        line.counterpartyId ? [line.counterpartyId] : []
      ),
      ...requestedLines.flatMap((line) =>
        line.counterpartyId ? [line.counterpartyId] : []
      ),
    ]),
  ];

  return repo.findByIds(counterpartyIds, accountingEntityId, repoOptions);
}
