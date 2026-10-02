import { and, eq } from 'drizzle-orm';

import { IRepoOptions } from '@shared/types/repo.types';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import IBankAccountRepo from '@domain/ledger/repos/bank-account.repo';

import { bankDetailsInCore } from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import bankAccountMapper from '@infra/persistence/repos/ledger/mappers/bank-account.mapper';

/** Matches only the bank identity constraint, including Drizzle cause wrappers. */
function isBankIdentityConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const isConflict =
    'code' in error &&
    error.code === '23505' &&
    'constraint' in error &&
    error.constraint === 'bank_accounts_pkey';
  if (isConflict) return true;
  return 'cause' in error && isBankIdentityConflict(error.cause);
}

const bankAccountRepoImpl: IBankAccountRepo = {
  findOne: async (bankName, accountNumber, options) => {
    const baseQuery = getDbQuery((options ?? {}) as IRepoOptions)
      .select()
      .from(bankDetailsInCore)
      .where(
        and(
          eq(bankDetailsInCore.bankName, bankName),
          eq(bankDetailsInCore.accountNumber, accountNumber)
        )
      );
    const query = options?.lock ? baseQuery.for(options.lock) : baseQuery;
    const [result] = await query;

    return result ? bankAccountMapper.toDomain(result) : null;
  },

  findByLedgerAccountId: async (ledgerAccountId, options) => {
    const baseQuery = getDbQuery((options ?? {}) as IRepoOptions)
      .select()
      .from(bankDetailsInCore)
      .where(eq(bankDetailsInCore.ledgerAccountId, ledgerAccountId));
    const query = options?.lock ? baseQuery.for(options.lock) : baseQuery;
    const [result] = await query;

    return result ? bankAccountMapper.toDomain(result) : null;
  },

  create: async (
    ledgerAccountId,
    accountingEntityId,
    bankValue,
    createdBy,
    options
  ) => {
    try {
      const model = bankAccountMapper.toRepo(
        ledgerAccountId,
        accountingEntityId,
        bankValue,
        createdBy
      );
      await getDbQuery(options).insert(bankDetailsInCore).values(model);
    } catch (err: unknown) {
      if (isBankIdentityConflict(err)) {
        throw new ledgerAccountError.DuplicateBankAccount({
          bankName: bankValue.bankName,
          accountNumber: bankValue.accountNumber,
        });
      }
      throw err;
    }
  },
};

export default bankAccountRepoImpl;
