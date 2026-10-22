import { and, eq, gte, lte } from 'drizzle-orm';

import passOnRepoTransaction from '@shared/helpers/passon-repo-transaction';

import IAccountingPeriodRepo from '@domain/accounting/repos/accounting-period.repo.deprecated';

import { accountingPeriodsInCore } from '@infra/config/drizzle/schema';
import { toRepoDateOnly } from '@infra/persistence/helpers/date.mapper';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import mapAccountingPeriodOverlapErrorHelper from '@infra/persistence/helpers/map-accounting-period-overlap-error.helper';
import accountingPeriodMapper from '@infra/persistence/repos/accounting/mappers/accounting-period.mapper';

import accountingPeriodHistoryRepo from './accounting-period-history.repo.impl';

const accountingPeriodRepoImpl: IAccountingPeriodRepo = {
  findAllByFiscalYear: async (accountingEntityId, fiscalYearId, options) => {
    const periods = await getDbQuery(options)
      .select()
      .from(accountingPeriodsInCore)
      .where(
        and(
          eq(accountingPeriodsInCore.accountingEntityId, accountingEntityId),
          eq(accountingPeriodsInCore.fiscalYearId, fiscalYearId)
        )
      )
      .orderBy(accountingPeriodsInCore.startDate, accountingPeriodsInCore.id);

    return periods.map(accountingPeriodMapper.toDomain);
  },

  findById: async (accountingEntityId, id, options) => {
    const [period] = await getDbQuery(options)
      .select()
      .from(accountingPeriodsInCore)
      .where(
        and(
          eq(accountingPeriodsInCore.id, id),
          eq(accountingPeriodsInCore.accountingEntityId, accountingEntityId)
        )
      )
      .limit(1);

    return period ? accountingPeriodMapper.toDomain(period) : null;
  },

  findByDate: async (accountingEntityId, date, options) => {
    const repoDate = toRepoDateOnly(date);
    const baseQuery = getDbQuery(options)
      .select()
      .from(accountingPeriodsInCore)
      .where(
        and(
          eq(accountingPeriodsInCore.accountingEntityId, accountingEntityId),
          lte(accountingPeriodsInCore.startDate, repoDate),
          gte(accountingPeriodsInCore.endDate, repoDate)
        )
      );
    const query = options.lock ? baseQuery.for(options.lock) : baseQuery;
    const [period] = await query;

    return period ? accountingPeriodMapper.toDomain(period) : null;
  },

  findAllByDate: async (accountingEntityId, date, options) => {
    const repoDate = toRepoDateOnly(date);
    const baseQuery = getDbQuery(options)
      .select()
      .from(accountingPeriodsInCore)
      .where(
        and(
          eq(accountingPeriodsInCore.accountingEntityId, accountingEntityId),
          lte(accountingPeriodsInCore.startDate, repoDate),
          gte(accountingPeriodsInCore.endDate, repoDate)
        )
      );
    const query = options.lock ? baseQuery.for(options.lock) : baseQuery;
    const periods = await query;

    return periods.map(accountingPeriodMapper.toDomain);
  },

  findByRange: async (accountingEntityId, range, options) => {
    const baseQuery = getDbQuery(options)
      .select()
      .from(accountingPeriodsInCore)
      .where(
        and(
          eq(accountingPeriodsInCore.accountingEntityId, accountingEntityId),
          lte(accountingPeriodsInCore.startDate, toRepoDateOnly(range.endDate)),
          gte(accountingPeriodsInCore.endDate, toRepoDateOnly(range.startDate))
        )
      );
    const query = options.lock ? baseQuery.for(options.lock) : baseQuery;
    const periods = await query;
    return periods.map(accountingPeriodMapper.toDomain);
  },

  create: async (payload, options) => {
    try {
      await getDbQuery(options).transaction(async (tx) => {
        const valuesArray = Array.isArray(payload)
          ? payload.map(accountingPeriodMapper.toRepo)
          : [accountingPeriodMapper.toRepo(payload)];

        await tx.insert(accountingPeriodsInCore).values(valuesArray);

        await accountingPeriodHistoryRepo.save(
          payload,
          options.history,
          passOnRepoTransaction(options, tx)
        );
      });
    } catch (error) {
      throw mapAccountingPeriodOverlapErrorHelper(error);
    }
  },
};

export default accountingPeriodRepoImpl;
