import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import IAccountingPeriodService from '@domain/accounting/types/accounting-period.service.types';
import getOppositeJournalSide from '@domain/journal-entry/entities/helpers/get-opposite-side.helper';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryRectificationValidation from '@domain/journal-entry/services/validations/journal-entry-rectification.validation';
import journalEntryValidation from '@domain/journal-entry/services/validations/journal-entry.validation';
import {
  EJournalEntryRectificationMode,
  IJournalEntryRectificationPayload,
  IJournalEntryRectificationResult,
  IJournalEntryRectificationService,
  IJournalEntryReversalResult,
  UJournalEntryRectificationMode,
} from '@domain/journal-entry/types/journal-entry-rectification.types';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
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

function determineAction(
  payload: IJournalEntryRectificationPayload
): UJournalEntryRectificationMode {
  if (payload.originalEntry.status === EJournalEntryStatus.Draft) {
    return EJournalEntryRectificationMode.UpdateDraft;
  }

  return journalEntryEntity.hasOnlyMetadataChanges(
    payload.originalEntry,
    payload.newEntry
  )
    ? EJournalEntryRectificationMode.UpdateMeta
    : EJournalEntryRectificationMode.VoidAndReplace;
}

function updateEntry(
  payload: IJournalEntryRectificationPayload,
  mode: Exclude<UJournalEntryRectificationMode, 'void_and_replace'>
): IJournalEntryRectificationResult {
  const [currentJournalEntry, events, audit] = journalEntryEntity.update(
    payload.originalEntry,
    payload.newEntry,
    payload.actorId
  );
  const originalLineIds = new Set(
    payload.originalEntry.lines.map((line) => line.id)
  );
  const currentLineIds = new Set(
    currentJournalEntry.lines.map((line) => line.id)
  );
  const linesToCreate = currentJournalEntry.lines.filter(
    (line) => !originalLineIds.has(line.id)
  );
  const linesToUpdate = currentJournalEntry.lines.filter((line) => {
    const originalLine = payload.originalEntry.lines.find(
      (item) => item.id === line.id
    );

    return originalLine !== undefined && line.version !== originalLine.version;
  });
  const lineIdsToDelete = payload.originalEntry.lines
    .filter((line) => !currentLineIds.has(line.id))
    .map((line) => line.id);

  return {
    mode,
    originalJournalEntryId: payload.originalEntry.id,
    currentJournalEntry,
    reversingJournalEntry: null,
    entriesToCreate: [],
    entryUpdate: audit
      ? {
          entry: currentJournalEntry,
          expectedVersion: payload.originalEntry.version,
          headerAudit: audit.header,
          lineAudits: audit.lines,
          linesToCreate,
          linesToUpdate,
          lineIdsToDelete,
        }
      : null,
    events,
  };
}

async function voidAndReplace(
  deps: IDependencies,
  payload: IJournalEntryRectificationPayload,
  repoOptions: IReadRepoOptions
): Promise<IJournalEntryRectificationResult> {
  const { originalEntry, newEntry } = payload;
  const timestamp = new Date();
  const effectiveDate = newEntry.effectiveDate ?? originalEntry.effectiveDate;

  await deps.accountingPeriodService.validatePostingPeriod(
    originalEntry.accountingEntityId,
    effectiveDate,
    repoOptions
  );

  const correctedLines = newEntry.lines ?? originalEntry.lines;
  const functionalCurrency = correctedLines[0].functionalAmount.currency;
  const correctedEntry = journalEntryEntity.make({
    id: newEntry.id,
    accountingEntityId: originalEntry.accountingEntityId,
    sourceType: originalEntry.sourceType,
    effectiveDate,
    postedAt: timestamp,
    memo: newEntry.memo === undefined ? originalEntry.memo : newEntry.memo,
    createdBy: payload.actorId,
    functionalCurrency,
    attachments: newEntry.attachments ?? originalEntry.attachments,
    lines: correctedLines.map((line) => ({
      accountId: line.accountId,
      counterpartyId: line.counterpartyId,
      sequenceOrder: line.sequenceOrder,
      amount: line.amount,
      exchangeRate: line.exchangeRate,
      side: line.side,
      description: line.description,
      functionalCurrency,
    })),
  });
  const [correctedJournalEntry, correctedEvents] = correctedEntry;
  const reversal = await reverseEntry(
    deps,
    originalEntry,
    timestamp,
    payload.actorId,
    repoOptions
  );

  return {
    mode: EJournalEntryRectificationMode.VoidAndReplace,
    originalJournalEntryId: originalEntry.id,
    currentJournalEntry: correctedJournalEntry,
    reversingJournalEntry: reversal.reversingJournalEntry,
    entriesToCreate: [...reversal.entriesToCreate, correctedEntry],
    entryUpdate: reversal.entryUpdate,
    events: [...reversal.events, ...correctedEvents],
  };
}

/** Checks the reversal's own posting date before preparing it and voiding the original. */
async function reverseEntry(
  deps: IDependencies,
  originalEntry: IJournalEntryRectificationPayload['originalEntry'],
  timestamp: Date,
  actorId: TEntityId,
  repoOptions: IReadRepoOptions
): Promise<IJournalEntryReversalResult> {
  await deps.accountingPeriodService.validatePostingPeriod(
    originalEntry.accountingEntityId,
    timestamp,
    repoOptions
  );

  const functionalCurrency = originalEntry.lines[0].functionalAmount.currency;
  const reversalEntry = journalEntryEntity.make({
    accountingEntityId: originalEntry.accountingEntityId,
    sourceType: EJournalEntrySourceType.Reversal,
    effectiveDate: timestamp,
    postedAt: timestamp,
    memo: 'Journal entry reversal',
    createdBy: actorId,
    functionalCurrency,
    lines: originalEntry.lines.map((line) => ({
      accountId: line.accountId,
      counterpartyId: line.counterpartyId,
      sequenceOrder: line.sequenceOrder,
      amount: line.amount,
      exchangeRate: line.exchangeRate,
      side: getOppositeJournalSide(line.side),
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
 * Selects and prepares the invariant-preserving rectification for a journal
 * entry, rejecting archived accounts and invalid periods for newly posted entries.
 * Performs no persistence or event publication.
 */
function makeRectify(
  deps: IDependencies
): IJournalEntryRectificationService['rectify'] {
  return async (payload, repoOptions) => {
    journalEntryRectificationValidation.validatePayload(payload);

    const action = determineAction(payload);

    if (action === EJournalEntryRectificationMode.VoidAndReplace) {
      await validateAccounts(
        deps,
        [...payload.originalEntry.lines, ...(payload.newEntry.lines ?? [])].map(
          (line) => line.accountId
        ),
        payload.originalEntry.accountingEntityId,
        repoOptions
      );
      return voidAndReplace(deps, payload, repoOptions);
    }

    if (action === EJournalEntryRectificationMode.UpdateDraft) {
      await validateAccounts(
        deps,
        (payload.newEntry.lines ?? payload.originalEntry.lines).map(
          (line) => line.accountId
        ),
        payload.originalEntry.accountingEntityId,
        repoOptions
      );
    }

    const rectification = updateEntry(payload, action);
    const isPostingDraft =
      action === EJournalEntryRectificationMode.UpdateDraft &&
      rectification.currentJournalEntry.status === EJournalEntryStatus.Posted;

    if (isPostingDraft) {
      await deps.accountingPeriodService.validatePostingPeriod(
        rectification.currentJournalEntry.accountingEntityId,
        rectification.currentJournalEntry.effectiveDate,
        repoOptions
      );
    }

    return rectification;
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
    rectify: makeRectify(deps),
    reverse: makeReverse(deps),
  });
}
