import { sql } from 'drizzle-orm';

import type { TGetAccountCashFlowRepoQuery } from '@app/ledger/usecases/reporting/account-cash-flow/account-cash-flow.usecase';

import getDbQuery from '@infra/persistence/helpers/get-db-query';

interface IAggregateRow extends Record<string, unknown> {
  bucket_index: number;
  money_in: string;
  money_out: string;
}

const accountCashFlowRepoQuery: TGetAccountCashFlowRepoQuery = async (
  criteria,
  options
) => {
  const from = criteria.from.toISOString().slice(0, 10);
  const to = criteria.to.toISOString().slice(0, 10);
  const aggregates = await getDbQuery(options).execute<IAggregateRow>(sql`
      SELECT
        floor((entry.effective_date - ${from}::date)::numeric
          / ${criteria.bucketDays}::numeric)::integer AS bucket_index,
        coalesce(sum(line.amount) FILTER (WHERE line.side = 'debit'), 0)::text AS money_in,
        coalesce(sum(line.amount) FILTER (WHERE line.side = 'credit'), 0)::text AS money_out
      FROM core.journal_lines AS line
      INNER JOIN core.journal_entries AS entry ON entry.id = line.entry_id
      WHERE entry.accounting_entity_id = ${criteria.accountingEntityId}::uuid
        AND line.account_id = ${criteria.accountId}::uuid
        AND line.currency_code = ${criteria.currencyCode}
        AND entry.effective_date >= ${from}::date
        AND entry.effective_date < ${to}::date + 1
        AND entry.status <> 'draft'
        AND entry.posted_at IS NOT NULL
        AND entry.voiding_entry_id IS NULL
        AND entry.source_type NOT IN ('reversal', 'opening_balance')
      GROUP BY bucket_index
      ORDER BY bucket_index
    `);

  return aggregates.rows.map((aggregate) => ({
    bucketIndex: aggregate.bucket_index,
    moneyIn: BigInt(aggregate.money_in),
    moneyOut: BigInt(aggregate.money_out),
  }));
};

export default accountCashFlowRepoQuery;
