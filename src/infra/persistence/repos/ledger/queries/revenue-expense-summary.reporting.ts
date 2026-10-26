import { sql } from 'drizzle-orm';

import type { TGetRevenueExpenseSummaryRepoQuery } from '@app/ledger/usecases/reporting/revenue-expense-summary/revenue-expense-summary.usecase';

import getDbQuery from '@infra/persistence/helpers/get-db-query';

interface IAggregateRow extends Record<string, unknown> {
  account_id: string;
  account_name: string;
  account_type: 'revenue' | 'expense' | 'suspense';
  debits: string;
  credits: string;
  previous_debits: string;
  previous_credits: string;
  transaction_count: string;
  suspense_amount: string;
}

const revenueExpenseSummaryRepoQuery: TGetRevenueExpenseSummaryRepoQuery =
  async (criteria, options) => {
    const aggregates = await getDbQuery(options).execute<IAggregateRow>(sql`
      WITH periods AS (
        SELECT ${criteria.period.from.toISOString().slice(0, 10)}::date AS current_from,
          ${criteria.period.to.toISOString().slice(0, 10)}::date AS current_to,
          ${criteria.comparisonPeriod.from.toISOString().slice(0, 10)}::date AS previous_from,
          ${criteria.comparisonPeriod.to.toISOString().slice(0, 10)}::date AS previous_to
      ), scoped_lines AS (
        SELECT entry.id AS entry_id, account.id AS account_id,
          account.name AS account_name, account.type AS account_type,
          account.sub_type, line.side, line.functional_amount,
          entry.effective_date BETWEEN periods.current_from AND periods.current_to AS is_current
        FROM core.journal_lines AS line
        INNER JOIN core.journal_entries AS entry ON entry.id = line.entry_id
        INNER JOIN core.ledger_accounts AS account ON account.id = line.account_id
          AND account.accounting_entity_id = entry.accounting_entity_id
        CROSS JOIN periods
        WHERE entry.accounting_entity_id = ${criteria.accountingEntityId}::uuid
          AND line.functional_currency_code = ${criteria.currencyCode}
          AND (
            entry.effective_date BETWEEN periods.current_from AND periods.current_to
            OR entry.effective_date BETWEEN periods.previous_from AND periods.previous_to
          )
          AND entry.status <> 'draft'
          AND entry.posted_at IS NOT NULL
          AND entry.voiding_entry_id IS NULL
          AND entry.source_type NOT IN ('reversal', 'opening_balance')
          AND (account.type IN ('revenue', 'expense')
            OR (account.type IN ('asset', 'liability') AND account.sub_type = 'suspense'))
      )
      SELECT account_id::text, account_name, account_type::text,
        coalesce(sum(functional_amount) FILTER (WHERE is_current AND side = 'debit'), 0)::text AS debits,
        coalesce(sum(functional_amount) FILTER (WHERE is_current AND side = 'credit'), 0)::text AS credits,
        coalesce(sum(functional_amount) FILTER (WHERE NOT is_current AND side = 'debit'), 0)::text AS previous_debits,
        coalesce(sum(functional_amount) FILTER (WHERE NOT is_current AND side = 'credit'), 0)::text AS previous_credits,
        '0' AS transaction_count, '0' AS suspense_amount
      FROM scoped_lines
      WHERE account_type IN ('revenue', 'expense')
      GROUP BY account_id, account_name, account_type
      UNION ALL
      SELECT '' AS account_id, '' AS account_name, 'suspense' AS account_type,
        '0' AS debits, '0' AS credits, '0' AS previous_debits, '0' AS previous_credits,
        count(DISTINCT entry_id)::text AS transaction_count,
        coalesce(sum(functional_amount), 0)::text AS suspense_amount
      FROM scoped_lines
      WHERE sub_type = 'suspense' AND account_type IN ('asset', 'liability') AND is_current
    `);

    const accounts = aggregates.rows
      .filter((row) => row.account_type !== 'suspense')
      .map((row) => ({
        accountId: row.account_id,
        accountName: row.account_name,
        type: row.account_type as 'revenue' | 'expense',
        debits: BigInt(row.debits),
        credits: BigInt(row.credits),
        previousDebits: BigInt(row.previous_debits),
        previousCredits: BigInt(row.previous_credits),
      }));
    const suspense = aggregates.rows.find(
      (row) => row.account_type === 'suspense'
    );

    return {
      accounts,
      suspense: {
        transactionCount: BigInt(suspense?.transaction_count ?? '0'),
        amount: BigInt(suspense?.suspense_amount ?? '0'),
      },
    };
  };

export default revenueExpenseSummaryRepoQuery;
