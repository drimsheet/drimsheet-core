import { sql } from 'drizzle-orm';

import IAssetLiabilitySummaryQueryRepo from '@app/reporting/contracts/asset-liability-summary.query.repo.contract';

import getDbQuery from '@infra/persistence/helpers/get-db-query';

interface IAggregateRow extends Record<string, unknown> {
  account_type: 'asset' | 'liability';
  debits: string;
  credits: string;
  previous_debits: string;
  previous_credits: string;
}

const assetLiabilitySummaryQueryRepo: IAssetLiabilitySummaryQueryRepo = {
  aggregate: async (criteria, options) => {
    const aggregates = await getDbQuery(options).execute<IAggregateRow>(sql`
      WITH periods AS (
        SELECT ${criteria.period.to.toISOString().slice(0, 10)}::date AS current_to,
          ${criteria.comparisonPeriod.to.toISOString().slice(0, 10)}::date AS previous_to
      ), scoped_lines AS (
        SELECT account.type AS account_type, line.side, line.functional_amount,
          entry.effective_date <= periods.previous_to AS is_previous
        FROM core.journal_lines AS line
        INNER JOIN core.journal_entries AS entry ON entry.id = line.entry_id
        INNER JOIN core.ledger_accounts AS account ON account.id = line.account_id
          AND account.accounting_entity_id = entry.accounting_entity_id
        CROSS JOIN periods
        WHERE entry.accounting_entity_id = ${criteria.accountingEntityId}::uuid
          AND line.functional_currency_code = ${criteria.currencyCode}
          AND entry.effective_date <= periods.current_to
          AND entry.status NOT IN ('draft', 'voided')
          AND entry.posted_at IS NOT NULL
          AND entry.voiding_entry_id IS NULL
          AND entry.source_type <> 'reversal'
          AND account.type IN ('asset', 'liability')
      )
      SELECT account_type::text,
        coalesce(sum(functional_amount) FILTER (WHERE side = 'debit'), 0)::text AS debits,
        coalesce(sum(functional_amount) FILTER (WHERE side = 'credit'), 0)::text AS credits,
        coalesce(sum(functional_amount) FILTER (WHERE is_previous AND side = 'debit'), 0)::text AS previous_debits,
        coalesce(sum(functional_amount) FILTER (WHERE is_previous AND side = 'credit'), 0)::text AS previous_credits
      FROM scoped_lines
      GROUP BY account_type
    `);

    return {
      balances: aggregates.rows.map((row) => ({
        type: row.account_type,
        debits: BigInt(row.debits),
        credits: BigInt(row.credits),
        previousDebits: BigInt(row.previous_debits),
        previousCredits: BigInt(row.previous_credits),
      })),
    };
  },
};

export default assetLiabilitySummaryQueryRepo;
