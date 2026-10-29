import { sql } from 'drizzle-orm';

import type {
  IGetAccountActivityByTypesRepoQueryOutput,
  TGetAccountActivityByTypesRepoQuery,
} from '@app/ledger/usecases/reporting/account-activity-by-types/account-activity-by-types.usecase';

import getDbQuery from '@infra/persistence/helpers/get-db-query';

interface IAggregateRow extends Record<string, unknown> {
  account_type: IGetAccountActivityByTypesRepoQueryOutput['type'];
  bucket_index: number;
  debits: string;
  credits: string;
}

const accountActivityByTypesRepoQuery: TGetAccountActivityByTypesRepoQuery =
  async (criteria, options) => {
    const from = criteria.period.from.toISOString().slice(0, 10);
    const to = criteria.period.to.toISOString().slice(0, 10);
    const aggregates = await getDbQuery(options).execute<IAggregateRow>(sql`
    SELECT account.type AS account_type,
      floor((entry.effective_date - ${from}::date)::numeric
        / ${criteria.bucketDays}::numeric)::integer AS bucket_index,
      coalesce(sum(line.functional_amount) FILTER (WHERE line.side = 'debit'), 0)::text AS debits,
      coalesce(sum(line.functional_amount) FILTER (WHERE line.side = 'credit'), 0)::text AS credits
    FROM core.journal_lines AS line
    INNER JOIN core.journal_entries AS entry ON entry.id = line.entry_id
    INNER JOIN core.ledger_accounts AS account ON account.id = line.account_id
      AND account.accounting_entity_id = entry.accounting_entity_id
    WHERE entry.accounting_entity_id = ${criteria.accountingEntityId}::uuid
      AND line.functional_currency_code = ${criteria.currencyCode}
      AND entry.effective_date BETWEEN ${from}::date AND ${to}::date
      AND entry.status <> 'draft'
      AND entry.posted_at IS NOT NULL
      AND entry.voiding_entry_id IS NULL
      AND entry.source_type NOT IN ('reversal', 'opening_balance')
      AND account.type IN (${sql.join(
        criteria.types.map((type) => sql`${type}`),
        sql`, `
      )})
    GROUP BY account.type, bucket_index
    ORDER BY bucket_index, account.type
  `);
    return aggregates.rows.map((row) => ({
      type: row.account_type,
      bucketIndex: row.bucket_index,
      debits: BigInt(row.debits),
      credits: BigInt(row.credits),
    }));
  };

export default accountActivityByTypesRepoQuery;
