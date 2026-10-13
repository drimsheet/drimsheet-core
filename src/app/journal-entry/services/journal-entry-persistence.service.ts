import {
  IRepoService,
  TRepoTransactionFn,
} from '@shared/contracts/repo.contract';
import { ERepoLock, IRepoOptions } from '@shared/types/repo.types';

import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import IJournalEntryAttachmentRepo from '@domain/journal-entry/repos/journal-entry-attachment.repo';
import IJournalEntryHistoryRepo from '@domain/journal-entry/repos/journal-entry-history.repo';
import IJournalEntryRepo from '@domain/journal-entry/repos/journal-entry.repo';
import IJournalLineHistoryRepo from '@domain/journal-entry/repos/journal-line-history.repo';
import IJournalLineRepo from '@domain/journal-entry/repos/journal-line.repo';
import { IJournalEntry } from '@domain/journal-entry/types/journal-entry.types';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';

import IJournalEntryPersistenceAppService from '@app/journal-entry/contracts/journal-entry-persistence.service.contract';

interface IDependencies {
  repoService: IRepoService;
  ledgerAccountRepo: ILedgerAccountRepo;
  journalEntryAttachmentRepo: IJournalEntryAttachmentRepo;
  journalEntryHistoryRepo: IJournalEntryHistoryRepo;
  journalEntryRepo: IJournalEntryRepo;
  journalLineHistoryRepo: IJournalLineHistoryRepo;
  journalLineRepo: IJournalLineRepo;
}

/** Locks current account rows through commit so prepared lines cannot race a currency edit (LED-LA-008). */
async function assertPersistedAccountCurrencies(
  deps: IDependencies,
  entries: IJournalEntry[],
  options: IRepoOptions
) {
  const lines = entries.flatMap((entry) => entry.lines);
  if (lines.length === 0) {
    return;
  }
  const accounts = await deps.ledgerAccountRepo.findAllByIds(
    [...new Set(lines.map((line) => line.accountId))],
    { ...options, lock: ERepoLock.Share }
  );
  const accountsById = new Map(
    accounts.map((account) => [account.id, account])
  );
  for (const line of lines) {
    const account = accountsById.get(line.accountId);
    if (!account) {
      throw new journalEntryError.AccountNotFound({
        accountId: line.accountId,
      });
    }
    const hasCurrencyMismatch =
      account.currency !== null &&
      account.currency.code !== line.amount.currency.code;
    if (hasCurrencyMismatch) {
      throw new journalEntryError.JournalLineAccountCurrencyMismatch({
        accountId: line.accountId,
      });
    }
  }
}

/**
  Creates a new journal line and header in the persistence layer.
  Ensures there are no invariance.
 */

function makeCreate(
  deps: IDependencies
): IJournalEntryPersistenceAppService['create'] {
  return async (entry, headerHistory, linesHistory, repoOptions) => {
    const transactionFn: TRepoTransactionFn = async (tx) => {
      const writeOptions = { ...repoOptions, tx };
      await assertPersistedAccountCurrencies(deps, [entry], writeOptions);
      const { lines, attachments, ...header } = entry;

      await deps.journalEntryRepo.create(header, {
        ...writeOptions,
        history: headerHistory,
      });

      await deps.journalLineRepo.create(lines, {
        ...writeOptions,
        history: linesHistory,
        accountingEntityId: header.accountingEntityId,
      });

      if (attachments.length) {
        await deps.journalEntryAttachmentRepo.save(
          entry.id,
          attachments,
          writeOptions
        );
      }
    };

    await deps.repoService.runInTransaction(transactionFn, repoOptions.tx);
  };
}

/**
 * Persists a prepared rectification bundle without selecting its accounting
 * behavior. The caller owns the outer workflow transaction.
 */
function makeRectify(
  deps: IDependencies
): IJournalEntryPersistenceAppService['rectify'] {
  return async (payload, repoOptions) => {
    const transactionFn: TRepoTransactionFn = async (tx) => {
      const writeOptions = { ...repoOptions, tx };

      const entries = payload.entriesToCreate.map((creation) => creation.entry);
      if (payload.entryUpdate) {
        entries.push(payload.entryUpdate.entry);
      }
      await assertPersistedAccountCurrencies(deps, entries, writeOptions);

      for (const creation of payload.entriesToCreate) {
        const { entry, headerHistory, lineHistories } = creation;
        const { lines, attachments, ...header } = entry;

        await deps.journalEntryRepo.create(header, {
          ...writeOptions,
          history: headerHistory,
        });
        await deps.journalLineRepo.create(lines, {
          ...writeOptions,
          accountingEntityId: entry.accountingEntityId,
          history: lineHistories,
        });

        if (attachments.length) {
          await deps.journalEntryAttachmentRepo.save(
            entry.id,
            attachments,
            writeOptions
          );
        }
      }

      if (payload.entryUpdate) {
        const update = payload.entryUpdate;
        const { lines: _lines, attachments, ...header } = update.entry;

        await deps.journalEntryRepo.update(header, {
          ...writeOptions,
          expectedVersion: update.expectedVersion,
          history: update.headerHistory,
        });

        await deps.journalLineRepo.delete(update.lineIdsToDelete, writeOptions);

        const lineHistoryById = new Map(
          update.lineHistories.map((history) => [history.entityId, history])
        );

        if (update.linesToCreate.length) {
          await deps.journalLineRepo.create(update.linesToCreate, {
            ...writeOptions,
            accountingEntityId: update.entry.accountingEntityId,
            history: update.linesToCreate.map(
              (line) => lineHistoryById.get(line.id)!
            ),
          });
        }

        for (const line of update.linesToUpdate) {
          await deps.journalLineRepo.update(line, {
            ...writeOptions,
            accountingEntityId: update.entry.accountingEntityId,
            expectedVersion: line.version - 1,
            history: lineHistoryById.get(line.id)!,
          });
        }

        await deps.journalEntryAttachmentRepo.save(
          update.entry.id,
          attachments,
          writeOptions
        );
      }
    };

    await deps.repoService.runInTransaction(transactionFn, repoOptions.tx);
  };
}

/**
 * Atomically removes a never-posted journal aggregate and all of its audit
 * history. A stale header version rolls the history deletions back.
 */
function makeDelete(
  deps: IDependencies
): IJournalEntryPersistenceAppService['delete'] {
  return async (payload, repoOptions) => {
    const transactionFn: TRepoTransactionFn = async (tx) => {
      const writeOptions = { ...repoOptions, tx };

      await deps.journalLineHistoryRepo.deleteByJournalEntryId(
        payload.journalEntryId,
        writeOptions
      );

      await deps.journalEntryHistoryRepo.deleteByJournalEntryId(
        payload.journalEntryId,
        writeOptions
      );

      await deps.journalEntryRepo.delete(payload.journalEntryId, {
        ...writeOptions,
        expectedVersion: payload.expectedVersion,
      });
    };

    await deps.repoService.runInTransaction(transactionFn, repoOptions.tx);
  };
}

export default function makeJournalEntryPersistenceAppService(
  deps: IDependencies
) {
  const service: IJournalEntryPersistenceAppService = Object.freeze({
    create: makeCreate(deps),
    rectify: makeRectify(deps),
    delete: makeDelete(deps),
  });

  return service;
}
