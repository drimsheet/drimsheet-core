import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { IJournalEntryService } from '@domain/journal-entry/types/journal-entry.service.types';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
} from '@domain/journal-entry/types/journal-entry.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';

import IJournalEntryQueryRepo from '@app/journal-entry/contracts/journal-entry.query.repo.contract';
import getJournalEntryPersistencePayloadHelper from '@app/journal-entry/usecases/helpers/get-journal-entry-persistence-payload.helper';
import IFxLotAppService from '@app/subledger/fx-cost-basis/contracts/fx-lot.service.contract';

interface IDependencies {
  journalEntryQueryRepo: IJournalEntryQueryRepo;
  journalEntryService: IJournalEntryService;
  fxLotAppService: IFxLotAppService;
}

/** Prepares the associated draft opening journal and its FX/history effects before the atomic write phase. Other draft journals are not selected. */
export default async function openingBalanceActivationPreparationHelper(
  deps: IDependencies,
  account: ILedgerAccount,
  actor: TEntityId,
  repoOptions: IReadRepoOptions
) {
  const openingBalances = await deps.journalEntryQueryRepo.findAll(
    account.accountingEntityId,
    {
      ...repoOptions,
      accountId: account.id,
      sourceType: EJournalEntrySourceType.OpeningBalance,
      status: EJournalEntryStatus.Draft,
      limit: 1,
    }
  );
  const originalEntry = openingBalances.data[0];

  if (!originalEntry) {
    return null;
  }

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
