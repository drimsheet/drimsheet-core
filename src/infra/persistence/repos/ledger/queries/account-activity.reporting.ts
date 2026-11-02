import { sql } from 'drizzle-orm';

import type { TGetAccountActivityRepoQuery } from '@app/ledger/usecases/reporting/account-activity/account-activity.usecase';

import getDbQuery from '@infra/persistence/helpers/get-db-query';

interface IAggregateRow extends Record<string, unknown> {
  bucket_index: number;
  debits: string;
  credits: string;
}

const accountActivityRepoQuery: TGetAccountActivityRepoQuery = async (
  criteria,
  options
) => {
  const from = criteria.period.from.toISOString().slice(0, 10);
  const to = criteria.period.to.toISOString().slice(0, 10);
  const aggregates = await getDbQuery(options).execute<IAggregateRow>(sql`
    WITH requested_account AS (
      SELECT id, accounting_entity_id, materialized_path
      FROM core.ledger_accounts
      WHERE id = ${criteria.accountId}::uuid
        AND accounting_entity_id = ${criteria.accountingEntityId}::uuid
    )
    SELECT floor((entry.effective_date - ${from}::date)::numeric
        / ${criteria.bucketDays}::numeric)::integer AS bucket_index,
      coalesce(sum(line.functional_amount) FILTER (WHERE line.side = 'debit'), 0)::text AS debits,
      coalesce(sum(line.functional_amount) FILTER (WHERE line.side = 'credit'), 0)::text AS credits
    FROM core.journal_lines AS line
    INNER JOIN core.journal_entries AS entry ON entry.id = line.entry_id
    INNER JOIN core.ledger_accounts AS account ON account.id = line.account_id
      AND account.accounting_entity_id = entry.accounting_entity_id
    INNER JOIN requested_account AS requested
      ON requested.accounting_entity_id = account.accounting_entity_id
      AND (account.id = requested.id
        OR account.materialized_path LIKE requested.materialized_path || '.%')
    WHERE entry.accounting_entity_id = ${criteria.accountingEntityId}::uuid
      AND line.functional_currency_code = ${criteria.currencyCode}
      AND entry.effective_date BETWEEN ${from}::date AND ${to}::date
      AND entry.status <> 'draft'
      AND entry.posted_at IS NOT NULL
      AND entry.voiding_entry_id IS NULL
      AND entry.source_type NOT IN ('reversal', 'opening_balance')
    GROUP BY bucket_index
    ORDER BY bucket_index
  `);
  return aggregates.rows.map((row) => ({
    bucketIndex: row.bucket_index,
    debits: BigInt(row.debits),
    credits: BigInt(row.credits),
  }));
};

export default accountActivityRepoQuery;
