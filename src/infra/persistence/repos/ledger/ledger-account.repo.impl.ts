import {
  and,
  desc,
  eq,
  getTableColumns,
  getTableName,
  inArray,
  like,
  notExists,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import passOnRepoTransaction from '@shared/helpers/passon-repo-transaction';
import validateVersionInRepo from '@shared/helpers/validate-version-in-repo';
import repoError from '@shared/values/errors/repo.error';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';

import {
  currenciesInCore,
  journalLinesInCore,
  ledgerAccountsInCore,
} from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import ledgerAccountMapper from '@infra/persistence/repos/ledger/mappers/ledger-account.mapper';

import ledgerAccountHistoryRepo from './ledger-account-history.repo.impl';

/** Recognizes only the suspense uniqueness index, including Drizzle cause wrappers. */
function isSuspenseDuplicate(error: unknown): boolean {
  const isObject = typeof error === 'object' && error !== null;
  if (!isObject) {
    return false;
  }

  const isDuplicate =
    'code' in error &&
    error.code === '23505' &&
    'constraint' in error &&
    error.constraint === 'ledger_accounts_suspense_entity_type_currency_uk';
  if (isDuplicate) {
    return true;
  }
  return 'cause' in error && isSuspenseDuplicate(error.cause);
}

const ledgerAccountRepoImpl: ILedgerAccountRepo = {
  delete: async (id, options) => {
    await getDbQuery(options).transaction(async (tx) => {
      const deleted = await tx.delete(ledgerAccountsInCore).where(
        and(
          eq(ledgerAccountsInCore.id, id),
          eq(ledgerAccountsInCore.version, options.expectedVersion),
          // Never let the account FK cascade remove only one side of a journal.
          notExists(
            tx
              .select({ id: journalLinesInCore.id })
              .from(journalLinesInCore)
              .where(eq(journalLinesInCore.accountId, id))
          )
        )
      );

      if (deleted.rowCount === 0) {
        throw new repoError.VersionNotFound({
          id,
          version: options.expectedVersion,
        });
      }

      await ledgerAccountHistoryRepo.deleteByAccountId(
        id,
        passOnRepoTransaction(options, tx)
      );
    });
  },

  create: async (payload, options) => {
    try {
      await getDbQuery(options).transaction(async (tx) => {
        const accountsArray = Array.isArray(payload) ? payload : [payload];
        const valuesArray = accountsArray.map(ledgerAccountMapper.toRepo);

        await tx.insert(ledgerAccountsInCore).values(valuesArray);
        await ledgerAccountHistoryRepo.save(
          options.history,
          passOnRepoTransaction(options, tx)
        );
      });
    } catch (error) {
      if (isSuspenseDuplicate(error)) {
        throw new ledgerAccountError.SuspenseAccountAlreadyExists();
      }
      throw error;
    }
  },

  update: async (account, options) => {
    validateVersionInRepo(account, options);

    await getDbQuery(options).transaction(async (tx) => {
      const updated = await tx
        .update(ledgerAccountsInCore)
        .set(ledgerAccountMapper.toRepo(account))
        .where(
          and(
            eq(ledgerAccountsInCore.id, account.id),
            eq(ledgerAccountsInCore.version, options.expectedVersion)
          )
        );

      if (updated.rowCount === 0) {
        throw new repoError.VersionNotFound({
          id: account.id,
          version: options.expectedVersion,
        });
      }

      await ledgerAccountHistoryRepo.save(
        options.history,
        passOnRepoTransaction(options, tx)
      );
    });
  },

  findById: async (id, accountingEntityId, options) => {
    const baseQuery = getDbQuery(options)
      .select({
        ...getTableColumns(ledgerAccountsInCore),
        currency: getTableColumns(currenciesInCore),
      })
      .from(ledgerAccountsInCore)
      .leftJoin(
        currenciesInCore,
        eq(ledgerAccountsInCore.currencyCode, currenciesInCore.code)
      )
      .where(
        and(
          eq(ledgerAccountsInCore.id, id),
          eq(ledgerAccountsInCore.accountingEntityId, accountingEntityId)
        )
      );

    const query = options.lock
      ? baseQuery.for(options.lock, {
          of: alias(ledgerAccountsInCore, getTableName(ledgerAccountsInCore)),
        })
      : baseQuery;
    const result = await query;
    return result.map(ledgerAccountMapper.toDomain)[0] ?? null;
  },

  findAllByIds: async (ids, accountingEntityId, options) => {
    if (ids.length === 0) {
      return [];
    }
    const baseQuery = getDbQuery(options)
      .select({
        ...getTableColumns(ledgerAccountsInCore),
        currency: getTableColumns(currenciesInCore),
      })
      .from(ledgerAccountsInCore)
      .leftJoin(
        currenciesInCore,
        eq(ledgerAccountsInCore.currencyCode, currenciesInCore.code)
      )
      .where(
        and(
          inArray(ledgerAccountsInCore.id, ids),
          eq(ledgerAccountsInCore.accountingEntityId, accountingEntityId)
        )
      )
      .orderBy(ledgerAccountsInCore.materializedPath);

    const query = options.lock
      ? baseQuery.for(options.lock, {
          of: alias(ledgerAccountsInCore, getTableName(ledgerAccountsInCore)),
        })
      : baseQuery;
    const result = await query;

    return result.map(ledgerAccountMapper.toDomain);
  },

  findAllByMaterializedPath: async (
    accountingEntityId,
    materializedPaths,
    options
  ) => {
    if (materializedPaths.length === 0) {
      return [];
    }

    const result = await getDbQuery(options)
      .select({
        ...getTableColumns(ledgerAccountsInCore),
        currency: getTableColumns(currenciesInCore),
      })
      .from(ledgerAccountsInCore)
      .leftJoin(
        currenciesInCore,
        eq(ledgerAccountsInCore.currencyCode, currenciesInCore.code)
      )
      .where(
        and(
          eq(ledgerAccountsInCore.accountingEntityId, accountingEntityId),
          inArray(ledgerAccountsInCore.materializedPath, materializedPaths)
        )
      );

    return result.map(ledgerAccountMapper.toDomain);
  },

  findDescendants: async (accountingEntityId, materializedPath, options) => {
    const baseQuery = getDbQuery(options)
      .select({
        ...getTableColumns(ledgerAccountsInCore),
        currency: getTableColumns(currenciesInCore),
      })
      .from(ledgerAccountsInCore)
      .leftJoin(
        currenciesInCore,
        eq(ledgerAccountsInCore.currencyCode, currenciesInCore.code)
      )
      .where(
        and(
          eq(ledgerAccountsInCore.accountingEntityId, accountingEntityId),
          like(ledgerAccountsInCore.materializedPath, `${materializedPath}.%`)
        )
      )
      .orderBy(ledgerAccountsInCore.materializedPath);
    const query = options.lock
      ? baseQuery.for(options.lock, {
          of: alias(ledgerAccountsInCore, getTableName(ledgerAccountsInCore)),
        })
      : baseQuery;
    const rows = await query;
    return rows.map(ledgerAccountMapper.toDomain);
  },

  findByCode: async (code, accountingEntityId, options) => {
    const baseQuery = getDbQuery(options)
      .select({
        ...getTableColumns(ledgerAccountsInCore),
        currency: getTableColumns(currenciesInCore),
      })
      .from(ledgerAccountsInCore)
      .leftJoin(
        currenciesInCore,
        eq(ledgerAccountsInCore.currencyCode, currenciesInCore.code)
      )
      .where(
        and(
          eq(ledgerAccountsInCore.accountingEntityId, accountingEntityId),
          eq(ledgerAccountsInCore.code, code)
        )
      );
    // FOR ... OF requires an unqualified table name and must exclude the nullable join.
    const query = options.lock
      ? baseQuery.for(options.lock, {
          of: alias(ledgerAccountsInCore, getTableName(ledgerAccountsInCore)),
        })
      : baseQuery;
    const result = await query;

    return result.map(ledgerAccountMapper.toDomain)[0] ?? null;
  },

  findBySubType: async (accountingEntityId, type, subType, options) => {
    const dbQuery = getDbQuery(options);

    const results = await dbQuery
      .select({
        ...getTableColumns(ledgerAccountsInCore),
        currency: getTableColumns(currenciesInCore),
      })
      .from(ledgerAccountsInCore)
      .leftJoin(
        currenciesInCore,
        eq(ledgerAccountsInCore.currencyCode, currenciesInCore.code)
      )
      .where(
        and(
          eq(ledgerAccountsInCore.accountingEntityId, accountingEntityId),
          eq(ledgerAccountsInCore.type, type),
          eq(ledgerAccountsInCore.subType, subType)
        )
      );

    return results.map(ledgerAccountMapper.toDomain);
  },

  findByBehavior: async (accountingEntityId, behavior, options) => {
    const dbQuery = getDbQuery(options);

    const results = await dbQuery
      .select({
        ...getTableColumns(ledgerAccountsInCore),
        currency: getTableColumns(currenciesInCore),
      })
      .from(ledgerAccountsInCore)
      .leftJoin(
        currenciesInCore,
        eq(ledgerAccountsInCore.currencyCode, currenciesInCore.code)
      )
      .where(
        and(
          eq(ledgerAccountsInCore.accountingEntityId, accountingEntityId),
          eq(ledgerAccountsInCore.behavior, behavior)
        )
      );

    return results.map(ledgerAccountMapper.toDomain);
  },

  findLatestBySubType: async (accountingEntityId, type, subType, options) => {
    const baseQuery = getDbQuery(options)
      .select({
        id: ledgerAccountsInCore.id,
        code: ledgerAccountsInCore.code,
        materializedPath: ledgerAccountsInCore.materializedPath,
      })
      .from(ledgerAccountsInCore)
      .where(
        and(
          eq(ledgerAccountsInCore.accountingEntityId, accountingEntityId),
          eq(ledgerAccountsInCore.type, type),
          eq(ledgerAccountsInCore.subType, subType)
        )
      )
      .orderBy(desc(ledgerAccountsInCore.code))
      .limit(1);
    const query = options.lock ? baseQuery.for(options.lock) : baseQuery;
    const [result] = await query;

    return result as unknown as ReturnType<
      ILedgerAccountRepo['findLatestBySubType']
    >;
  },
};

export default ledgerAccountRepoImpl;
