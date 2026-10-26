import { sql } from 'drizzle-orm';

import type { TGetLedgerTotalDebitsAndCreditsByCurrencyRepoQuery } from '@app/ledger/usecases/reporting/ledger-total-debits-and-credits-by-currency/ledger-total-debits-and-credits-by-currency.usecase';

import getDbQuery from '@infra/persistence/helpers/get-db-query';

interface IAggregateRow extends Record<string, unknown> {
  currency_code: string;
  debits: string;
  credits: string;
}

const ledgerTotalDebitsAndCreditsByCurrencyRepoQuery: TGetLedgerTotalDebitsAndCreditsByCurrencyRepoQuery =
  async (criteria, options) => {
    const result = await getDbQuery(options).execute<IAggregateRow>(sql`
    SELECT line.currency_code,
      coalesce(sum(line.amount) FILTER (WHERE line.side = 'debit'), 0)::text AS debits,
      coalesce(sum(line.amount) FILTER (WHERE line.side = 'credit'), 0)::text AS credits
    FROM core.journal_lines AS line
    INNER JOIN core.journal_entries AS entry ON entry.id = line.entry_id
    INNER JOIN core.ledger_accounts AS account ON account.id = line.account_id
      AND account.accounting_entity_id = entry.accounting_entity_id
    WHERE entry.accounting_entity_id = ${criteria.accountingEntityId}::uuid
      AND account.type = ${criteria.type}
      AND entry.effective_date >= ${criteria.period.from.toISOString().slice(0, 10)}::date
      AND entry.effective_date <= ${criteria.period.to.toISOString().slice(0, 10)}::date
      AND entry.status NOT IN ('draft', 'voided')
    GROUP BY line.currency_code
    ORDER BY line.currency_code
  `);
    return result.rows.map((row) => ({
      currencyCode: row.currency_code,
      debits: BigInt(row.debits),
      credits: BigInt(row.credits),
    }));
  };

export default ledgerTotalDebitsAndCreditsByCurrencyRepoQuery;
