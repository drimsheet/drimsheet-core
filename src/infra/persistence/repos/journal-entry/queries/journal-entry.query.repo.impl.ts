import { and, eq, ilike, inArray, ne, sql } from 'drizzle-orm';

import drizzleFilters from '@shared/helpers/drizzle-filters';
import paginationValue from '@shared/values/pagination/pagination.vo';

import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
} from '@domain/journal-entry/types/journal-entry.types';

import IJournalEntryQueryRepo, {
  EJournalEntrySortBy,
} from '@app/journal-entry/contracts/journal-entry.query.repo.contract';

import {
  journalEntriesInCore,
  journalLinesInCore,
} from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import journalEntryDetailsMapper from '@infra/persistence/repos/journal-entry/mappers/journal-entry-details.mapper';

const journalEntryQueryRepo: IJournalEntryQueryRepo = {
  async findById(id, accountingEntityId, options) {
    const entry = await getDbQuery(
      options
    ).query.journalEntriesInCore.findFirst({
      where: and(
        eq(journalEntriesInCore.id, id),
        eq(journalEntriesInCore.accountingEntityId, accountingEntityId)
      ),
      with: {
        journalEntryAttachmentsInCores: true,
        journalLinesInCores: {
          with: {
            ledgerAccountsInCore: {
              columns: { id: true, name: true },
            },
            counterpartiesInCore: {
              columns: { id: true, name: true, status: true },
            },
          },
        },
      },
    });

    return entry ? journalEntryDetailsMapper.toDetails(entry) : null;
  },

  async findAll(accountingEntityId, options) {
    const dbQuery = getDbQuery(options);
    const conditions = [
      eq(journalEntriesInCore.accountingEntityId, accountingEntityId),
      ne(journalEntriesInCore.sourceType, EJournalEntrySourceType.Reversal),
    ];

    if (options.status) {
      conditions.push(eq(journalEntriesInCore.status, options.status));
    } else {
      conditions.push(
        inArray(journalEntriesInCore.status, [
          EJournalEntryStatus.Draft,
          EJournalEntryStatus.Posted,
        ])
      );
    }

    if (options.accountId) {
      const accountEntryIds = dbQuery
        .select({ entryId: journalLinesInCore.entryId })
        .from(journalLinesInCore)
        .where(eq(journalLinesInCore.accountId, options.accountId));

      conditions.push(inArray(journalEntriesInCore.id, accountEntryIds));
    }

    if (options.counterpartyId) {
      const counterpartyEntryIds = dbQuery
        .select({ entryId: journalLinesInCore.entryId })
        .from(journalLinesInCore)
        .where(eq(journalLinesInCore.counterpartyId, options.counterpartyId));

      conditions.push(inArray(journalEntriesInCore.id, counterpartyEntryIds));
    }

    if (options.search) {
      conditions.push(ilike(journalEntriesInCore.memo, `%${options.search}%`));
    }

    const whereClause = and(...conditions);
    const [countResult] = await dbQuery
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(journalEntriesInCore)
      .where(whereClause);
    const totalCount = countResult?.count ?? 0;

    if (totalCount === 0) {
      return paginationValue.getPaginatedResponse([], 0, options);
    }

    const direction = drizzleFilters.getSortDirection(
      paginationValue.getSortDirection(options.sortDirection)
    );
    const orderByColumn =
      options.orderBy === EJournalEntrySortBy.EffectiveDate
        ? journalEntriesInCore.effectiveDate
        : journalEntriesInCore.createdAt;
    const limit = paginationValue.getLimit(options.limit);
    const offset = paginationValue.getOffset(options.offset);

    const entries = await dbQuery.query.journalEntriesInCore.findMany({
      where: whereClause,
      with: {
        journalEntryAttachmentsInCores: true,
        journalLinesInCores: {
          with: {
            ledgerAccountsInCore: {
              columns: { id: true, name: true },
            },
            counterpartiesInCore: {
              columns: { id: true, name: true, status: true },
            },
          },
        },
      },
      orderBy: [direction(orderByColumn), direction(journalEntriesInCore.id)],
      limit,
      offset,
    });

    return paginationValue.getPaginatedResponse(
      entries.map(journalEntryDetailsMapper.toDetails),
      totalCount,
      options
    );
  },
};

export default journalEntryQueryRepo;
