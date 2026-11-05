import { sql } from 'drizzle-orm';

import type {
  IGetCounterpartyAccountTypeParticipationRepoQueryOutput,
  TGetCounterpartyAccountTypeParticipationRepoQuery,
} from '@app/counterparty/usecases/reporting/participation-by-account-type/participation-by-account-type.usecase';

import getDbQueryHelper from '@infra/persistence/helpers/get-db-query.helper';

interface IAggregateRow extends Record<string, unknown> {
  account_type: IGetCounterpartyAccountTypeParticipationRepoQueryOutput['type'];
  debits: string;
  credits: string;
}

const counterpartyAccountTypeParticipationRepoQuery: TGetCounterpartyAccountTypeParticipationRepoQuery =
  async (criteria, options) => {
    const aggregates = await getDbQueryHelper(options)
      .execute<IAggregateRow>(sql`
      SELECT account.type AS account_type,
        coalesce(sum(line.functional_amount) FILTER (WHERE line.side = 'debit'), 0)::text AS debits,
        coalesce(sum(line.functional_amount) FILTER (WHERE line.side = 'credit'), 0)::text AS credits
      FROM core.journal_lines AS line
      INNER JOIN core.journal_entries AS entry ON entry.id = line.entry_id
      INNER JOIN core.ledger_accounts AS account ON account.id = line.account_id
        AND account.accounting_entity_id = entry.accounting_entity_id
      WHERE entry.accounting_entity_id = ${criteria.accountingEntityId}::uuid
        AND line.counterparty_id = ${criteria.counterpartyId}::uuid
        AND line.functional_currency_code = ${criteria.currencyCode}
        AND entry.effective_date BETWEEN ${criteria.period.from.toISOString().slice(0, 10)}::date
          AND ${criteria.period.to.toISOString().slice(0, 10)}::date
        AND entry.status <> 'draft'
        AND entry.posted_at IS NOT NULL
        AND account.type IN ('revenue', 'expense')
      GROUP BY account.type
    `);

    return aggregates.rows.map((aggregate) => ({
      type: aggregate.account_type,
      debits: BigInt(aggregate.debits),
      credits: BigInt(aggregate.credits),
    }));
  };

export default counterpartyAccountTypeParticipationRepoQuery;
