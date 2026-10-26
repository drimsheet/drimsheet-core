import { sql } from 'drizzle-orm';

import type { TGetTotalBalanceByTypeRepoQuery } from '@app/ledger/usecases/reporting/total-balance-by-type/total-balance-by-type.usecase';

import getDbQuery from '@infra/persistence/helpers/get-db-query';

interface IAccountRow extends Record<string, unknown> {
  id: string;
  functional_amount: string | null;
}

const totalBalanceByTypeRepoQuery: TGetTotalBalanceByTypeRepoQuery = async (
  { accountingEntityId, type, functionalCurrencyCode },
  options
) => {
  const accounts = await getDbQuery(options).execute<IAccountRow>(sql`
      SELECT account.id::text, balance.functional_amount::text
      FROM core.ledger_accounts AS account
      LEFT JOIN core.ledger_account_balances AS balance
        ON balance.ledger_account_id = account.id
        AND balance.accounting_entity_id = account.accounting_entity_id
        AND balance.functional_currency_code = ${functionalCurrencyCode}
        AND balance.currency_code = ${functionalCurrencyCode}
      WHERE account.accounting_entity_id = ${accountingEntityId}::uuid
        AND account.type = ${type}
        AND account.control_account_id IS NULL
      ORDER BY account.id
    `);
  return accounts.rows.map((account) => ({
    accountId: account.id,
    functionalAmount:
      account.functional_amount === null
        ? null
        : BigInt(account.functional_amount),
  }));
};

export default totalBalanceByTypeRepoQuery;
