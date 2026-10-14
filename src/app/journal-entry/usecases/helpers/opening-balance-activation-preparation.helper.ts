import { IReadRepoOptions } from '@shared/types/repo.types';

import { IJournalEntryService } from '@domain/journal-entry/types/journal-entry.service.types';

import getJournalEntryPersistencePayloadHelper from '@app/journal-entry/usecases/helpers/get-journal-entry-persistence-payload.helper';
import IFxLotAppService from '@app/subledger/fx-cost-basis/contracts/fx-lot.service.contract';

interface IDependencies {
  journalEntryService: IJournalEntryService;
  fxLotAppService: IFxLotAppService;
}

/** Prepares posting, FX acquisition, and histories for a caller-selected opening journal without initiating persistence. Domain validation failures reject before the atomic write phase. */
export default async function openingBalanceActivationPreparationHelper(
  deps: IDependencies,
  payload: Parameters<IJournalEntryService['postOpeningBalance']>[0],
  repoOptions: IReadRepoOptions
) {
  const { entry: originalEntry, account, actor } = payload;

  const [entry, events, audit] =
    await deps.journalEntryService.postOpeningBalance(
      { entry: originalEntry, account, actor },
      repoOptions
    );

  const fxAcquisition = await deps.fxLotAppService.acquire(
    { journalEntry: entry, account, actor },
    repoOptions
  );
  const persistence = getJournalEntryPersistencePayloadHelper(
    {
      entriesToCreate: [],
      entryUpdate: {
        entry,
        expectedVersion: originalEntry.version,
        headerAudit: audit.header,
        lineAudits: audit.lines,
        linesToCreate: [],
        linesToUpdate: [],
        lineIdsToDelete: [],
      },
    },
    actor,
    repoOptions.correlationId
  );

  return { entry, events, persistence, fxAcquisition };
}
