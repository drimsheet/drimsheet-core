import { IReadRepoOptions } from '@shared/types/repo.types';

import IJournalEntryRepo from '@domain/journal-entry/repos/journal-entry.repo';
import {
  IOpeningBalanceEntryService,
  IOpeningBalanceJournalPayload,
} from '@domain/journal-entry/types/opening-balance-entry.service.types';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import { ELedgerAccountStatus } from '@domain/ledger/types/ledger.types';

interface IDependencies {
  journalEntryRepo: IJournalEntryRepo;
  openingBalanceEntryService: IOpeningBalanceEntryService;
}

/** Selects the opening journal operation for an account edit under the caller's account lock. */
export default async function prepareOpeningBalanceEditHelper(
  deps: IDependencies,
  payload: IOpeningBalanceJournalPayload,
  repoOptions: IReadRepoOptions
) {
  const { account, accountingEntityId } = payload;
  const hasPostedActivity = await deps.journalEntryRepo.existsPostedByAccountId(
    account.id,
    accountingEntityId,
    repoOptions
  );
  if (hasPostedActivity) {
    throw new ledgerAccountError.OpeningBalanceLocked({
      accountId: account.id,
    });
  }

  const draft = await deps.journalEntryRepo.findDraftOpeningBalanceByAccountId(
    account.id,
    accountingEntityId,
    repoOptions
  );

  if (!draft) {
    const create =
      account.status === ELedgerAccountStatus.Draft
        ? deps.openingBalanceEntryService.createDraft
        : deps.openingBalanceEntryService.create;
    const creation = await create(payload, repoOptions);
    const [currentJournalEntry, events] = creation;

    return {
      currentJournalEntry,
      events,
      entriesToCreate: [creation],
      entryUpdate: null,
    };
  }

  const [currentJournalEntry, events, audit] =
    await deps.openingBalanceEntryService.updateDraft(
      { ...payload, entry: draft },
      repoOptions
    );
  const entryUpdate = audit
    ? {
        entry: currentJournalEntry,
        expectedVersion: draft.version,
        headerAudit: audit.header,
        lineAudits: audit.lines,
        linesToCreate: [],
        linesToUpdate: currentJournalEntry.lines.filter((line) =>
          audit.lines.some((lineAudit) => lineAudit.entityId === line.id)
        ),
        lineIdsToDelete: [],
      }
    : null;

  return { currentJournalEntry, events, entriesToCreate: [], entryUpdate };
}
