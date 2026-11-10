import { and, eq, getTableColumns, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import validateVersionInRepoHelper from '@shared/helpers/validate-version-in-repo.helper';
import repoError from '@shared/values/errors/repo.error';

import ILedgerAccountBalanceRepo from '@domain/ledger/repos/ledger-account-balance.repo';

import {
  currenciesInCore,
  ledgerAccountBalanceAdjustmentsInCore,
  ledgerAccountBalancesInCore,
} from '@infra/config/drizzle/schema';
import getDbQueryHelper from '@infra/persistence/helpers/get-db-query.helper';
import mapLedgerBalanceFunctionalCurrencyErrorHelper from '@infra/persistence/helpers/map-ledger-balance-functional-currency-error.helper';
import ledgerAccountBalanceMapper from '@infra/persistence/repos/ledger/mappers/ledger-account-balance.mapper';

const functionalCurrenciesInCore = alias(
  currenciesInCore,
  'functional_currencies'
);

const ledgerAccountBalanceRepoImpl: ILedgerAccountBalanceRepo = {
  async create(payload, options) {
    try {
      const query = getDbQueryHelper(options);

      const values = ledgerAccountBalanceMapper.toRepo(payload);

      await query.insert(ledgerAccountBalancesInCore).values(values);
    } catch (error) {
      throw mapLedgerBalanceFunctionalCurrencyErrorHelper(error);
    }
  },

  async createWithAdjustments(payload, options) {
    try {
      await getDbQueryHelper(options).transaction(async (tx) => {
        await tx
          .insert(ledgerAccountBalancesInCore)
          .values(ledgerAccountBalanceMapper.toRepo(payload.balance));

        if (payload.adjustments.length > 0) {
          await tx
            .insert(ledgerAccountBalanceAdjustmentsInCore)
            .values(
              payload.adjustments.map(
                ledgerAccountBalanceMapper.toRepoAdjustment
              )
            );
        }
      });
    } catch (error) {
      throw mapLedgerBalanceFunctionalCurrencyErrorHelper(error);
    }
  },

  async update(balance, options) {
    try {
      validateVersionInRepoHelper(balance, options);

      const updated = await getDbQueryHelper(options)
        .update(ledgerAccountBalancesInCore)
        .set(ledgerAccountBalanceMapper.toRepo(balance))
        .where(
          and(
            eq(
              ledgerAccountBalancesInCore.ledgerAccountId,
              balance.ledgerAccountId
            ),
            eq(
              ledgerAccountBalancesInCore.accountingEntityId,
              balance.accountingEntityId
            ),
            eq(ledgerAccountBalancesInCore.version, options.expectedVersion)
          )
        );

      if (updated.rowCount === 0) {
        throw new repoError.VersionNotFound({
          id: balance.ledgerAccountId,
          version: options.expectedVersion,
        });
      }
    } catch (error) {
      throw mapLedgerBalanceFunctionalCurrencyErrorHelper(error);
    }
  },

  async findByAccountId(ledgerAccountId, accountingEntityId, options) {
    const query = getDbQueryHelper(options);

    const [result] = await query
      .select({
        ...getTableColumns(ledgerAccountBalancesInCore),
        currency: getTableColumns(currenciesInCore),
        functionalCurrency: getTableColumns(functionalCurrenciesInCore),
      })
      .from(ledgerAccountBalancesInCore)
      .innerJoin(
        currenciesInCore,
        eq(ledgerAccountBalancesInCore.currencyCode, currenciesInCore.code)
      )
      .innerJoin(
        functionalCurrenciesInCore,
        eq(
          ledgerAccountBalancesInCore.functionalCurrencyCode,
          functionalCurrenciesInCore.code
        )
      )
      .where(
        and(
          eq(ledgerAccountBalancesInCore.ledgerAccountId, ledgerAccountId),
          eq(ledgerAccountBalancesInCore.accountingEntityId, accountingEntityId)
        )
      );

    return result ? ledgerAccountBalanceMapper.toDomain(result) : null;
  },

  async adjustBalance(payload, options) {
    try {
      const { newBalance, adjustment } = payload;
      validateVersionInRepoHelper(newBalance, options);

      await getDbQueryHelper(options).transaction(async (tx) => {
        await tx
          .insert(ledgerAccountBalanceAdjustmentsInCore)
          .values(ledgerAccountBalanceMapper.toRepoAdjustment(adjustment));

        const updated = await tx
          .update(ledgerAccountBalancesInCore)
          .set(ledgerAccountBalanceMapper.toRepo(newBalance))
          .where(
            and(
              eq(
                ledgerAccountBalancesInCore.ledgerAccountId,
                newBalance.ledgerAccountId
              ),
              eq(
                ledgerAccountBalancesInCore.accountingEntityId,
                newBalance.accountingEntityId
              ),
              eq(ledgerAccountBalancesInCore.version, options.expectedVersion)
            )
          );

        if (updated.rowCount === 0) {
          throw new repoError.VersionNotFound({
            id: payload.newBalance.ledgerAccountId,
            version: options.expectedVersion,
          });
        }
      });
    } catch (error) {
      throw mapLedgerBalanceFunctionalCurrencyErrorHelper(error);
    }
  },

  async findAdjustmentsByAccountId(ledgerAccountId, options) {
    const result = await getDbQueryHelper(options)
      .select()
      .from(ledgerAccountBalanceAdjustmentsInCore)
      .where(
        and(
          eq(
            ledgerAccountBalanceAdjustmentsInCore.ledgerAccountId,
            ledgerAccountId
          )
        )
      );

    return result.map(ledgerAccountBalanceMapper.fromRepoAdjustment);
  },

  async findAllByAccountingEntityId(accountingEntityId, options) {
    const result = await getDbQueryHelper(options)
      .select({
        ...getTableColumns(ledgerAccountBalancesInCore),
        currency: getTableColumns(currenciesInCore),
        functionalCurrency: getTableColumns(functionalCurrenciesInCore),
      })
      .from(ledgerAccountBalancesInCore)
      .innerJoin(
        currenciesInCore,
        eq(ledgerAccountBalancesInCore.currencyCode, currenciesInCore.code)
      )
      .innerJoin(
        functionalCurrenciesInCore,
        eq(
          ledgerAccountBalancesInCore.functionalCurrencyCode,
          functionalCurrenciesInCore.code
        )
      )
      .where(
        eq(ledgerAccountBalancesInCore.accountingEntityId, accountingEntityId)
      );

    return result.map(ledgerAccountBalanceMapper.toDomain);
  },

  async findAllByAccountIds(accountingEntityId, ledgerAccountIds, options) {
    if (ledgerAccountIds.length === 0) {
      return [];
    }

    const result = await getDbQueryHelper(options)
      .select({
        ...getTableColumns(ledgerAccountBalancesInCore),
        currency: getTableColumns(currenciesInCore),
        functionalCurrency: getTableColumns(functionalCurrenciesInCore),
      })
      .from(ledgerAccountBalancesInCore)
      .innerJoin(
        currenciesInCore,
        eq(ledgerAccountBalancesInCore.currencyCode, currenciesInCore.code)
      )
      .innerJoin(
        functionalCurrenciesInCore,
        eq(
          ledgerAccountBalancesInCore.functionalCurrencyCode,
          functionalCurrenciesInCore.code
        )
      )
      .where(
        and(
          eq(
            ledgerAccountBalancesInCore.accountingEntityId,
            accountingEntityId
          ),
          inArray(ledgerAccountBalancesInCore.ledgerAccountId, ledgerAccountIds)
        )
      );

    return result.map(ledgerAccountBalanceMapper.toDomain);
  },
};

export default ledgerAccountBalanceRepoImpl;
