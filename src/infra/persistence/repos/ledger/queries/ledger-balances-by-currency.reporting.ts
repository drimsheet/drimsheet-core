import { sql } from 'drizzle-orm';

import type { TGetLedgerBalancesByCurrencyRepoQuery } from '@app/ledger/usecases/reporting/ledger-balances-by-currency/ledger-balances-by-currency.usecase';

import getDbQuery from '@infra/persistence/helpers/get-db-query';

interface IAccountRow extends Record<string, unknown> {
  id: string;
  currency_code: string;
  amount: string | null;
  functional_amount: string | null;
}

const ledgerBalancesByCurrencyRepoQuery: TGetLedgerBalancesByCurrencyRepoQuery =
  async ({ accountingEntityId, type, functionalCurrencyCode }, options) => {
    const accounts = await getDbQuery(options).execute<IAccountRow>(sql`
      SELECT account.id::text,
        COALESCE(account.currency_code, ${functionalCurrencyCode}) AS currency_code,
        balance.amount::text, balance.functional_amount::text
      FROM core.ledger_accounts AS account
      LEFT JOIN core.ledger_account_balances AS balance
        ON balance.ledger_account_id = account.id
        AND balance.accounting_entity_id = account.accounting_entity_id
        AND balance.functional_currency_code = ${functionalCurrencyCode}
        AND balance.currency_code =
          COALESCE(account.currency_code, ${functionalCurrencyCode})
      WHERE account.accounting_entity_id = ${accountingEntityId}::uuid
        AND account.type = ${type}
        AND account.is_control_account = false
      ORDER BY currency_code, account.id
    `);

    return accounts.rows.map((account) => ({
      accountId: account.id,
      currencyCode: account.currency_code,
      amount: account.amount === null ? null : BigInt(account.amount),
      functionalAmount:
        account.functional_amount === null
          ? null
          : BigInt(account.functional_amount),
    }));
  };

export default ledgerBalancesByCurrencyRepoQuery;
