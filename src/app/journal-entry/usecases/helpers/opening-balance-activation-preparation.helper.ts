import { IReadRepoOptions } from '@shared/types/repo.types';

import { IOpeningBalanceEntryService } from '@domain/journal-entry/types/opening-balance-entry.service.types';
import IFxCostBasisLotService from '@domain/subledger/fx-cost-basis/types/lot.service.types';

import getJournalEntryPersistencePayloadHelper from '@app/journal-entry/usecases/helpers/get-journal-entry-persistence-payload.helper';
import IExchangeRateAppService from '@app/money/contracts/exchange-rate.service.contract';
import resolveOfficialRateHelper from '@app/subledger/fx-cost-basis/resolve-official-rate.helper';

interface IDependencies {
  openingBalanceEntryService: IOpeningBalanceEntryService;
  fxCostBasisLotService: IFxCostBasisLotService;
  exchangeRateAppService: IExchangeRateAppService;
}

/** Prepares posting, FX acquisition, and histories for a caller-selected opening journal without initiating persistence. Domain validation failures reject before the atomic write phase. */
export default async function openingBalanceActivationPreparationHelper(
  deps: IDependencies,
  payload: Parameters<IOpeningBalanceEntryService['postDraft']>[0],
  repoOptions: IReadRepoOptions
) {
  const { entry: originalEntry, account, actor } = payload;

  const [entry, events, audit] =
    await deps.openingBalanceEntryService.postDraft(
      { entry: originalEntry, account, actor },
      repoOptions
    );

  if (!audit) {
    return null;
  }

  const fxAcquisition = deps.fxCostBasisLotService.acquire({
    journalEntry: entry,
    account,
    createdBy: actor,
    officialRate: await resolveOfficialRateHelper(
      deps.exchangeRateAppService,
      entry.lines,
      account.id,
      repoOptions
    ),
  });
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
