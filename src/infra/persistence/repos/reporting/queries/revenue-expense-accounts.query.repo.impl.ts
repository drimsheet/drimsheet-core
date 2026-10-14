import { sql } from 'drizzle-orm';

import IRevenueExpenseAccountsQueryRepo, {
  IRevenueExpenseAccountBalance,
} from '@app/reporting/contracts/revenue-expense-accounts.query.repo.contract';

import getDbQuery from '@infra/persistence/helpers/get-db-query';

interface IAccountRow extends Record<string, unknown> {
  id: string;
  name: string;
  code: string;
  type: IRevenueExpenseAccountBalance['type'];
  sub_type: string;
  status: IRevenueExpenseAccountBalance['status'];
  is_control_account: boolean;
  control_account_id: string | null;
  functional_balance: string | null;
  transaction_count: string;
}

const revenueExpenseAccountsQueryRepo: IRevenueExpenseAccountsQueryRepo = {
  async findAll(accountingEntityId, currencyCode, options) {
    const accounts = await getDbQuery(options).execute<IAccountRow>(sql`
      WITH accounts AS (
        SELECT id, name, code, type, sub_type, status, is_control_account,
          control_account_id, accounting_entity_id
        FROM core.ledger_accounts
        WHERE accounting_entity_id = ${accountingEntityId}::uuid
          AND (type IN ('revenue', 'expense')
            OR (type IN ('asset', 'liability') AND sub_type = 'suspense'))
          AND (is_control_account = false
            OR (is_control_account = true AND control_account_id IS NULL
              AND type IN ('revenue', 'expense')))
      ), transaction_counts AS (
        SELECT account.id, count(*)::text AS transaction_count
        FROM accounts AS account
        INNER JOIN core.journal_lines AS line ON line.account_id = account.id
        INNER JOIN core.journal_entries AS entry ON entry.id = line.entry_id
          AND entry.accounting_entity_id = account.accounting_entity_id
        WHERE account.is_control_account = false
        GROUP BY account.id
      )
      SELECT account.id::text, account.name, account.code, account.type::text,
        account.sub_type, account.status::text, account.is_control_account,
        account.control_account_id::text,
        balance.functional_amount::text AS functional_balance,
        coalesce(counts.transaction_count, '0') AS transaction_count
      FROM accounts AS account
      LEFT JOIN core.ledger_account_balances AS balance
        ON balance.ledger_account_id = account.id
        AND balance.accounting_entity_id = account.accounting_entity_id
        AND balance.functional_currency_code = ${currencyCode}
      LEFT JOIN transaction_counts AS counts ON counts.id = account.id
      ORDER BY account.code, account.id
    `);

    return accounts.rows.map((account) => ({
      accountId: account.id,
      accountName: account.name,
      code: account.code,
      type: account.type,
      subType: account.sub_type,
      status: account.status,
      isControlAccount: account.is_control_account,
      controlAccountId: account.control_account_id,
      functionalBalance:
        account.functional_balance === null
          ? null
          : BigInt(account.functional_balance),
      transactionCount: BigInt(account.transaction_count),
    }));
  },
};

export default revenueExpenseAccountsQueryRepo;
