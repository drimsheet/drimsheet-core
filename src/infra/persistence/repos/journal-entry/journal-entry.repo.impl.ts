import { and, eq, inArray, isNotNull, isNull, ne } from 'drizzle-orm';

import passOnRepoTransaction from '@shared/helpers/passon-repo-transaction';
import validateVersionInRepo from '@shared/helpers/validate-version-in-repo';
import repoError from '@shared/values/errors/repo.error';

import IJournalEntryRepo from '@domain/journal-entry/repos/journal-entry.repo';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
} from '@domain/journal-entry/types/journal-entry.types';

import {
  journalEntriesInCore,
  journalLinesInCore,
} from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import journalEntryMapper from '@infra/persistence/repos/journal-entry/mappers/journal-entry.mapper';

import journalEntryHistoryRepo from './journal-entry-history.repo.impl';

const journalEntryRepo: IJournalEntryRepo = {
  async existsPostedByAccountId(accountId, accountingEntityId, options) {
    const references = await getDbQuery(options)
      .select({ id: journalLinesInCore.id })
      .from(journalLinesInCore)
      .innerJoin(
        journalEntriesInCore,
        eq(journalEntriesInCore.id, journalLinesInCore.entryId)
      )
      .where(
        and(
          eq(journalLinesInCore.accountId, accountId),
          eq(journalEntriesInCore.accountingEntityId, accountingEntityId),
          isNotNull(journalEntriesInCore.postedAt)
        )
      )
      .limit(1);

    return references.length > 0;
  },

  async existsByAccountId(accountId, accountingEntityId, options) {
    const references = await getDbQuery(options)
      .select({ id: journalLinesInCore.id })
      .from(journalLinesInCore)
      .innerJoin(
        journalEntriesInCore,
        eq(journalEntriesInCore.id, journalLinesInCore.entryId)
      )
      .where(
        and(
          eq(journalLinesInCore.accountId, accountId),
          eq(journalEntriesInCore.accountingEntityId, accountingEntityId)
        )
      )
      .limit(1);

    return references.length > 0;
  },

  async findAllByAccountIds(accountIds, accountingEntityId, options) {
    if (accountIds.length === 0) {
      return [];
    }

    const db = getDbQuery(options);
    const entryIds = db
      .select({ id: journalLinesInCore.entryId })
      .from(journalLinesInCore)
      .where(inArray(journalLinesInCore.accountId, accountIds));
    const entries = await db.query.journalEntriesInCore.findMany({
      where: and(
        eq(journalEntriesInCore.accountingEntityId, accountingEntityId),
        inArray(journalEntriesInCore.id, entryIds)
      ),
      with: {
        journalEntryAttachmentsInCores: true,
        journalLinesInCores: true,
      },
      orderBy: journalEntriesInCore.id,
    });

    return entries.map((entry) => journalEntryMapper.toDomain(entry));
  },

  create: async (payload, options) => {
    const entriesArray = Array.isArray(payload) ? payload : [payload];
    const historiesArray = Array.isArray(options.history)
      ? options.history
      : [options.history];

    await getDbQuery(options).transaction(async (tx) => {
      const entries = entriesArray.map(journalEntryMapper.toRepo);
      await tx.insert(journalEntriesInCore).values(entries);

      await journalEntryHistoryRepo.create(
        entriesArray,
        historiesArray,
        passOnRepoTransaction(options, tx)
      );
    });
  },

  update: async (payload, options) => {
    validateVersionInRepo(payload, options);

    await getDbQuery(options).transaction(async (tx) => {
      const updated = await tx
        .update(journalEntriesInCore)
        .set(journalEntryMapper.toRepo(payload))
        .where(
          and(
            eq(journalEntriesInCore.id, payload.id),
            eq(journalEntriesInCore.version, options.expectedVersion)
          )
        );

      if (updated.rowCount === 0) {
        throw new repoError.VersionNotFound({
          id: payload.id,
          version: options.expectedVersion,
        });
      }

      await journalEntryHistoryRepo.create(
        payload,
        options.history,
        passOnRepoTransaction(options, tx)
      );
    });
  },

  delete: async (id, options) => {
    const deleted = await getDbQuery(options)
      .delete(journalEntriesInCore)
      .where(
        and(
          eq(journalEntriesInCore.id, id),
          eq(journalEntriesInCore.version, options.expectedVersion),
          isNull(journalEntriesInCore.postedAt),
          inArray(journalEntriesInCore.status, [
            EJournalEntryStatus.Draft,
            EJournalEntryStatus.Archived,
          ]),
          ne(journalEntriesInCore.sourceType, EJournalEntrySourceType.Reversal)
        )
      );

    if (deleted.rowCount === 0) {
      throw new repoError.VersionNotFound({
        id,
        version: options.expectedVersion,
      });
    }
  },

  async findById(id, options) {
    const response = await getDbQuery(
      options
    ).query.journalEntriesInCore.findFirst({
      where: eq(journalEntriesInCore.id, id),
      with: {
        journalEntryAttachmentsInCores: true,
        journalLinesInCores: true,
      },
    });

    return response ? journalEntryMapper.toDomain(response) : null;
  },
};

export default journalEntryRepo;
