import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import IAccountingPeriodService from '@domain/accounting/types/accounting-period.service.types';
import getOppositeJournalSideHelper from '@domain/journal-entry/entities/helpers/get-opposite-side.helper';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryValidation from '@domain/journal-entry/services/validations/journal-entry.validation';
import {
  IJournalEntryRectificationService,
  IJournalEntryReversalResult,
} from '@domain/journal-entry/types/journal-entry-rectification.types';
import {
  EJournalEntrySourceType,
  IJournalEntry,
} from '@domain/journal-entry/types/journal-entry.types';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';

interface IDependencies {
  accountingPeriodService: IAccountingPeriodService;
  ledgerAccountRepo: ILedgerAccountRepo;
}

/** Reads current account status before preparing new journal associations. */
async function validateAccounts(
  deps: IDependencies,
  accountIds: TEntityId[],
  accountingEntityId: TEntityId,
  repoOptions: IReadRepoOptions
) {
  const accounts = await deps.ledgerAccountRepo.findAllByIds(
    [...new Set(accountIds)],
    accountingEntityId,
    repoOptions
  );

  journalEntryValidation.validateArchivedAccounts(accounts);
}

/** Validates the original period and prepares a reversal on its date. */
async function reverseEntry(
  deps: IDependencies,
  originalEntry: IJournalEntry,
  timestamp: Date,
  actorId: TEntityId,
  repoOptions: IReadRepoOptions
): Promise<IJournalEntryReversalResult> {
  await deps.accountingPeriodService.validatePostingPeriod(
    originalEntry.accountingEntityId,
    originalEntry.effectiveDate,
    repoOptions
  );

  const functionalCurrency = originalEntry.lines[0].functionalAmount.currency;
  const reversalEntry = journalEntryEntity.make({
    accountingEntityId: originalEntry.accountingEntityId,
    sourceType: EJournalEntrySourceType.Reversal,
    effectiveDate: originalEntry.effectiveDate,
    postedAt: timestamp,
    memo: null, // TODO: add memo if received by the caller
    createdBy: actorId,
    functionalCurrency,
    lines: originalEntry.lines.map((line) => ({
      accountId: line.accountId,
      counterpartyId: line.counterpartyId,
      sequenceOrder: line.sequenceOrder,
      amount: line.amount,
      exchangeRate: line.exchangeRate,
      side: getOppositeJournalSideHelper(line.side),
      description: line.description,
      functionalCurrency,
    })),
  });
  const [reversingJournalEntry, reversingEvents] = reversalEntry;
  const [voidedOriginal, voidEvents, voidAudit] = journalEntryEntity.void(
    originalEntry,
    {
      voidingEntryId: reversingJournalEntry.id,
    }
  );

  return {
    originalJournalEntryId: originalEntry.id,
    reversingJournalEntry,
    entriesToCreate: [reversalEntry],
    entryUpdate: voidAudit
      ? {
          entry: voidedOriginal,
          expectedVersion: originalEntry.version,
          headerAudit: voidAudit,
          lineAudits: [],
          linesToCreate: [],
          linesToUpdate: [],
          lineIdsToDelete: [],
        }
      : null,
    events: [...voidEvents, ...reversingEvents],
  };
}

/**
 * Prepares a balanced reversing entry and the original entry's Voided
 * transition after rejecting archived accounts and invalid reversal periods.
 * Performs no persistence or event publication.
 */
function makeReverse(
  deps: IDependencies
): IJournalEntryRectificationService['reverse'] {
  return async (originalEntry, actorId, repoOptions) => {
    await validateAccounts(
      deps,
      originalEntry.lines.map((line) => line.accountId),
      originalEntry.accountingEntityId,
      repoOptions
    );

    return reverseEntry(deps, originalEntry, new Date(), actorId, repoOptions);
  };
}

export default function makeJournalEntryRectificationService(
  deps: IDependencies
): IJournalEntryRectificationService {
  return Object.freeze({
    reverse: makeReverse(deps),
  });
}
