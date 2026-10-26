import { and, asc, eq, gte, lte } from 'drizzle-orm';

import passOnRepoTransaction from '@shared/helpers/passon-repo-transaction';

import IFiscalYearRepo from '@domain/accounting/repos/fiscal-year.repo';

import { fiscalYearsInCore } from '@infra/config/drizzle/schema';
import { toRepoDateOnly } from '@infra/persistence/helpers/date.mapper';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import mapFiscalYearOverlapErrorHelper from '@infra/persistence/helpers/map-fiscal-year-overlap-error.helper';
import fiscalYearMapper from '@infra/persistence/repos/accounting/mappers/fiscal-year.mapper';

import fiscalYearHistoryRepo from './fiscal-year-history.repo.impl';

const fiscalYearRepoImpl: IFiscalYearRepo = {
  findByAccountingEntityId: async (accountingEntityId, options) => {
    const years = await getDbQuery(options)
      .select()
      .from(fiscalYearsInCore)
      .where(eq(fiscalYearsInCore.accountingEntityId, accountingEntityId));

    return years.map(fiscalYearMapper.toDomain);
  },

  findByDate: async (accountingEntityId, date, options) => {
    const calendarDate = toRepoDateOnly(date);
    const years = await getDbQuery(options)
      .select()
      .from(fiscalYearsInCore)
      .where(
        and(
          eq(fiscalYearsInCore.accountingEntityId, accountingEntityId),
          lte(fiscalYearsInCore.startDate, calendarDate),
          gte(fiscalYearsInCore.endDate, calendarDate)
        )
      )
      .orderBy(asc(fiscalYearsInCore.startDate), asc(fiscalYearsInCore.id));

    return years.map(fiscalYearMapper.toDomain);
  },

  findById: async (accountingEntityId, id, options) => {
    const [year] = await getDbQuery(options)
      .select()
      .from(fiscalYearsInCore)
      .where(
        and(
          eq(fiscalYearsInCore.id, id),
          eq(fiscalYearsInCore.accountingEntityId, accountingEntityId)
        )
      )
      .limit(1);

    return year ? fiscalYearMapper.toDomain(year) : null;
  },

  existsByRange: async (accountingEntityId, range, options) => {
    const rows = await getDbQuery(options)
      .select({ id: fiscalYearsInCore.id })
      .from(fiscalYearsInCore)
      .where(
        and(
          eq(fiscalYearsInCore.accountingEntityId, accountingEntityId),
          lte(fiscalYearsInCore.startDate, toRepoDateOnly(range.endDate)),
          gte(fiscalYearsInCore.endDate, toRepoDateOnly(range.startDate))
        )
      )
      .limit(1);
    return rows.length > 0;
  },

  create: async (payload, options) => {
    try {
      await getDbQuery(options).transaction(async (tx) => {
        await tx
          .insert(fiscalYearsInCore)
          .values(fiscalYearMapper.toRepo(payload));

        await fiscalYearHistoryRepo.save(
          payload,
          options.history,
          passOnRepoTransaction(options, tx)
        );
      });
    } catch (error) {
      throw mapFiscalYearOverlapErrorHelper(error);
    }
  },
};

export default fiscalYearRepoImpl;
