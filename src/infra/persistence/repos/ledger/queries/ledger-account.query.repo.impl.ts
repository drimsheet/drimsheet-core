import { and, eq, getTableColumns } from 'drizzle-orm';

import ILedgerAccountQueryRepo from '@app/ledger/contracts/ledger-account.query.repo.contract';

import {
  currenciesInCore,
  ledgerAccountsInCore,
} from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import ledgerAccountMapper from '@infra/persistence/repos/ledger/mappers/ledger-account.mapper';

const ledgerAccountQueryRepo: ILedgerAccountQueryRepo = {
  findSubAccounts: async (accountId, accountingEntityId, options) => {
    const accounts = await getDbQuery(options)
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
          eq(ledgerAccountsInCore.controlAccountId, accountId)
        )
      )
      .orderBy(ledgerAccountsInCore.materializedPath);

    return accounts.map(ledgerAccountMapper.toDomain);
  },
};

export default ledgerAccountQueryRepo;
