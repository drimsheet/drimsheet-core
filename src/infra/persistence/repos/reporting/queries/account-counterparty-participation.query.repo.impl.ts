import { sql } from 'drizzle-orm';

import IAccountCounterpartyParticipationQueryRepo, {
  IAccountCounterpartyParticipationAggregate,
} from '@app/reporting/contracts/account-counterparty-participation.query.repo.contract';

import getDbQuery from '@infra/persistence/helpers/get-db-query';
import counterpartyMapper, {
  ICounterpartyModel,
} from '@infra/persistence/repos/counterparty/mappers/counterparty.mapper';

interface IAggregateRow extends Record<string, unknown> {
  counterparty: ICounterpartyModel | null;
  is_self: boolean;
  normal_balance: IAccountCounterpartyParticipationAggregate['normalBalance'];
  debits: string;
  credits: string;
  functional_debits: string;
  functional_credits: string;
}

const accountCounterpartyParticipationQueryRepo: IAccountCounterpartyParticipationQueryRepo =
  {
    async aggregateByAccount(criteria, options) {
      const aggregates = await getDbQuery(options).execute<IAggregateRow>(sql`
      WITH requested_account AS (
        SELECT id, accounting_entity_id, materialized_path, currency_code
        FROM core.ledger_accounts
        WHERE id = ${criteria.accountId}::uuid
          AND accounting_entity_id = ${criteria.accountingEntityId}::uuid
      ), scoped_lines AS (
        SELECT line.counterparty_id,
          (line.counterparty_id IS NULL AND entry.source_type = 'transfer') AS is_self,
          account.normal_balance, line.side,
          CASE WHEN requested.currency_code IS NULL THEN line.functional_amount
            ELSE line.amount END AS amount,
          line.functional_amount
        FROM requested_account AS requested
        INNER JOIN core.ledger_accounts AS account
          ON account.accounting_entity_id = requested.accounting_entity_id
          AND (account.id = requested.id
            OR account.materialized_path LIKE requested.materialized_path || '.%')
        INNER JOIN core.ledger_account_balance_adjustments AS adjustment
          ON adjustment.ledger_account_id = account.id
        INNER JOIN core.journal_entries AS entry ON entry.id = adjustment.journal_entry_id
          AND entry.accounting_entity_id = requested.accounting_entity_id
        INNER JOIN core.journal_lines AS line ON line.entry_id = entry.id
          AND line.account_id = account.id
        WHERE entry.status NOT IN ('draft', 'voided')
          AND entry.posted_at IS NOT NULL
          AND entry.voiding_entry_id IS NULL
          AND entry.source_type <> 'reversal'
          AND line.functional_currency_code = ${criteria.functionalCurrencyCode}
      ), contributions AS (
        SELECT counterparty_id, is_self, normal_balance,
          coalesce(sum(amount) FILTER (WHERE side = 'debit'), 0)::text AS debits,
          coalesce(sum(amount) FILTER (WHERE side = 'credit'), 0)::text AS credits,
          coalesce(sum(functional_amount) FILTER (WHERE side = 'debit'), 0)::text AS functional_debits,
          coalesce(sum(functional_amount) FILTER (WHERE side = 'credit'), 0)::text AS functional_credits
        FROM scoped_lines
        GROUP BY counterparty_id, is_self, normal_balance
      )
      SELECT CASE WHEN counterparty.id IS NULL THEN NULL ELSE json_build_object(
          'id', counterparty.id, 'createdBy', counterparty.created_by,
          'accountingEntityId', counterparty.accounting_entity_id,
          'name', counterparty.name, 'status', counterparty.status,
          'type', counterparty.type, 'version', counterparty.version,
          'meta', counterparty.meta, 'createdAt', counterparty.created_at,
          'updatedAt', counterparty.updated_at
        ) END AS counterparty,
        contributions.is_self, contributions.normal_balance,
        contributions.debits, contributions.credits,
        contributions.functional_debits, contributions.functional_credits
      FROM contributions
      LEFT JOIN core.counterparties AS counterparty ON counterparty.id = contributions.counterparty_id
        AND counterparty.accounting_entity_id = ${criteria.accountingEntityId}::uuid
      ORDER BY lower(counterparty.name) NULLS LAST, counterparty.id,
        contributions.is_self DESC, contributions.normal_balance
    `);

      return aggregates.rows.map((aggregate) => ({
        counterparty: aggregate.counterparty
          ? counterpartyMapper.toDomain(aggregate.counterparty)
          : null,
        isSelf: aggregate.is_self,
        normalBalance: aggregate.normal_balance,
        debits: BigInt(aggregate.debits),
        credits: BigInt(aggregate.credits),
        functionalDebits: BigInt(aggregate.functional_debits),
        functionalCredits: BigInt(aggregate.functional_credits),
      }));
    },
  };

export default accountCounterpartyParticipationQueryRepo;
