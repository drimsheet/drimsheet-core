import { sql, SQL } from 'drizzle-orm';

import IBalanceSeriesQueryRepo, {
  IBalanceSeriesAggregate,
  TBalanceSeriesFilter,
} from '@app/reporting/contracts/balance-series.query.repo.contract';

import getDbQuery from '@infra/persistence/helpers/get-db-query';

interface IAggregateRow extends Record<string, unknown> {
  account_id: string;
  account_type: IBalanceSeriesAggregate['type'];
  sub_type: string;
  behavior: string;
  normal_balance: IBalanceSeriesAggregate['normalBalance'];
  bucket_index: number;
  debits: string;
  credits: string;
}

/** Chooses a fixed column and binds every client-supplied filter value. */
function buildFilter(filter: TBalanceSeriesFilter): SQL {
  if ('types' in filter) {
    return sql`account.type IN (${sql.join(
      filter.types.map((type) => sql`${type}`),
      sql`, `
    )})`;
  }
  if ('subTypes' in filter) {
    return sql`account.sub_type IN (${sql.join(
      filter.subTypes.map((subType) => sql`${subType}`),
      sql`, `
    )})`;
  }
  if ('behaviors' in filter) {
    return sql`account.behavior IN (${sql.join(
      filter.behaviors.map((behavior) => sql`${behavior}`),
      sql`, `
    )})`;
  }
  return sql`account.id IN (${sql.join(
    filter.accountIds.map((id) => sql`${id}::uuid`),
    sql`, `
  )})`;
}

/** Keeps the highest matching ancestor per classification, or every explicit ID. */
function buildRootSelection(filter: TBalanceSeriesFilter): SQL {
  if ('accountIds' in filter) {
    return sql`true`;
  }
  const sameGroup =
    'types' in filter
      ? sql`ancestor.type = account.type`
      : 'subTypes' in filter
        ? sql`ancestor.type = account.type AND ancestor.sub_type = account.sub_type`
        : sql`ancestor.type = account.type AND ancestor.sub_type = account.sub_type
          AND ancestor.behavior = account.behavior`;
  return sql`NOT EXISTS (
    SELECT 1 FROM matching_accounts AS ancestor
    WHERE ${sameGroup}
      AND account.materialized_path LIKE ancestor.materialized_path || '.%'
  )`;
}

const balanceSeriesQueryRepo: IBalanceSeriesQueryRepo = {
  async aggregate(criteria, options) {
    const from = criteria.period.from.toISOString().slice(0, 10);
    const to = criteria.period.to.toISOString().slice(0, 10);
    const rows = await getDbQuery(options).execute<IAggregateRow>(sql`
      WITH matching_accounts AS (
        SELECT account.id, account.type, account.sub_type, account.behavior,
          account.normal_balance, account.materialized_path, account.accounting_entity_id
        FROM core.ledger_accounts AS account
        WHERE account.accounting_entity_id = ${criteria.accountingEntityId}::uuid
          AND account.deleted_at IS NULL
          AND ${buildFilter(criteria.filter)}
      ), selected_accounts AS (
        SELECT account.* FROM matching_accounts AS account
        WHERE ${buildRootSelection(criteria.filter)}
      ), activity AS (
        SELECT root.id AS account_id,
          CASE WHEN entry.effective_date < ${from}::date THEN -1
            ELSE floor((entry.effective_date - ${from}::date)::numeric
              / ${criteria.bucketDays}::numeric)::integer END AS bucket_index,
          coalesce(sum(line.functional_amount)
            FILTER (WHERE line.side = 'debit'), 0)::text AS debits,
          coalesce(sum(line.functional_amount)
            FILTER (WHERE line.side = 'credit'), 0)::text AS credits
        FROM core.journal_lines AS line
        INNER JOIN core.journal_entries AS entry ON entry.id = line.entry_id
        INNER JOIN core.ledger_accounts AS descendant ON descendant.id = line.account_id
          AND descendant.accounting_entity_id = entry.accounting_entity_id
        INNER JOIN selected_accounts AS root
          ON root.accounting_entity_id = descendant.accounting_entity_id
          AND (descendant.id = root.id
            OR descendant.materialized_path LIKE root.materialized_path || '.%')
        WHERE entry.accounting_entity_id = ${criteria.accountingEntityId}::uuid
          AND line.functional_currency_code = ${criteria.currencyCode}
          AND entry.effective_date <= ${to}::date
          AND entry.status NOT IN ('draft', 'voided')
          AND entry.posted_at IS NOT NULL
          AND entry.voiding_entry_id IS NULL
          AND entry.source_type <> 'reversal'
        GROUP BY root.id, bucket_index
      )
      SELECT account.id::text AS account_id, account.type AS account_type,
        account.sub_type, account.behavior, account.normal_balance,
        coalesce(activity.bucket_index, -1) AS bucket_index,
        coalesce(activity.debits, '0') AS debits,
        coalesce(activity.credits, '0') AS credits
      FROM selected_accounts AS account
      LEFT JOIN activity ON activity.account_id = account.id
      ORDER BY account.id, bucket_index
    `);
    return rows.rows.map((row) => ({
      accountId: row.account_id,
      type: row.account_type,
      subType: row.sub_type,
      behavior: row.behavior,
      normalBalance: row.normal_balance,
      bucketIndex: row.bucket_index,
      debits: BigInt(row.debits),
      credits: BigInt(row.credits),
    }));
  },
};

export default balanceSeriesQueryRepo;
