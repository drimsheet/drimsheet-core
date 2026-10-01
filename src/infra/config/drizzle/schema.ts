import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const core = pgSchema('core');
export const audit = pgSchema('audit');
export const accountingEntityTypeInCore = core.enum('accounting_entity_type', [
  'individual',
  'sole_trader',
  'private_company',
]);
export const adjunctAccountRuleInCore = core.enum('adjunct_account_rule', [
  'adjunct_permitted',
  'adjunct_not_permitted',
  'adjunct_only',
  'adjunct_not_applicable',
]);
export const contraAccountRuleInCore = core.enum('contra_account_rule', [
  'contra_permitted',
  'contra_not_permitted',
  'contra_only',
  'contra_not_applicable',
]);
export const counterPartyStatusInCore = core.enum('counter_party_status', [
  'active',
  'archived',
  'draft',
]);
export const counterPartyTypeInCore = core.enum('counter_party_type', [
  'individual',
  'organization',
]);
export const currencyExchangeRateTypeInCore = core.enum(
  'currency_exchange_rate_type',
  ['official', 'negotiated', 'market']
);
export const fiscalYearPeriodUnitInCore = core.enum('fiscal_year_period_unit', [
  'month',
]);
export const journalEntrySourceTypeInCore = core.enum(
  'journal_entry_source_type',
  [
    'sale',
    'purchase',
    'credit_note',
    'debit_note',
    'expense',
    'transfer',
    'payment',
    'receipt',
    'adjustment',
    'reversal',
    'opening_balance',
  ]
);
export const journalEntryStatusInCore = core.enum('journal_entry_status', [
  'draft',
  'posted',
  'voided',
  'archived',
]);
export const journalSideInCore = core.enum('journal_side', ['debit', 'credit']);
export const ledgerAccountBalanceEffectInCore = core.enum(
  'ledger_account_balance_effect',
  ['increase', 'decrease', 'noop']
);
export const ledgerAccountStatusInCore = core.enum('ledger_account_status', [
  'active',
  'archived',
]);
export const ledgerTypeInCore = core.enum('ledger_type', [
  'asset',
  'liability',
  'equity',
  'revenue',
  'expense',
]);
export const normalBalanceTypeInCore = core.enum('normal_balance_type', [
  'debit',
  'credit',
]);
export const periodStatusInCore = core.enum('period_status', [
  'pending',
  'open',
  'closing',
  'closed',
]);
export const periodUnitInCore = core.enum('period_unit', [
  'day',
  'week',
  'month',
  'quarter',
  'year',
]);
export const subledgerFxCostBasisLotStatusInCore = core.enum(
  'subledger_fx_cost_basis_lot_status',
  ['open', 'closed']
);

export const pgmigrations = pgTable('pgmigrations', {
  id: serial().primaryKey().notNull(),
  name: varchar({ length: 255 }).notNull(),
  runOn: timestamp('run_on', { mode: 'string' }).notNull(),
});

export const actorsInCore = core.table(
  'actors',
  {
    id: uuid().primaryKey().notNull(),
    type: varchar({ length: 20 }).notNull(),
    username: varchar({ length: 319 }).notNull(),
    displayName: varchar('display_name', { length: 319 }).notNull(),
    ownerActorId: uuid('owner_actor_id'),
    agentName: varchar('agent_name', { length: 64 }),
    status: varchar({ length: 20 }).notNull(),
    createdBy: uuid('created_by').notNull(),
    version: integer().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index().using('btree', table.createdBy.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [table.id],
      name: 'actors_created_by_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.ownerActorId],
      foreignColumns: [table.id],
      name: 'actors_owner_actor_id_fkey',
    }).onDelete('restrict'),
    unique('actors_username_key').on(table.username),
    unique('actors_owner_name_key').on(table.ownerActorId, table.agentName),
    check(
      'actors_display_name_ck',
      sql`length(btrim((display_name)::text)) > 0`
    ),
    check(
      'actors_owner_ck',
      sql`((owner_actor_id IS NULL) AND (agent_name IS NULL)) OR (((type)::text = 'ai_agent'::text) AND (owner_actor_id IS NOT NULL) AND (agent_name IS NOT NULL) AND ((agent_name)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND (owner_actor_id <> id))`
    ),
    check(
      'actors_status_ck',
      sql`(status)::text = ANY ((ARRAY['active'::character varying, 'disabled'::character varying])::text[])`
    ),
    check(
      'actors_type_ck',
      sql`(type)::text = ANY ((ARRAY['user'::character varying, 'system'::character varying, 'migration'::character varying, 'ai_agent'::character varying])::text[])`
    ),
    check(
      'actors_username_canonical_ck',
      sql`(length((username)::text) > 0) AND ((username)::text = lower(btrim((username)::text)))`
    ),
    check(
      'actors_username_kind_ck',
      sql`(((type)::text = 'user'::text) AND ((username)::text ~~ '%@%'::text)) OR (((type)::text = 'system'::text) AND ((username)::text = 'drimsheet-core'::text)) OR (((type)::text = 'migration'::text) AND ((username)::text = 'drimsheet-migration'::text)) OR (((type)::text = 'ai_agent'::text) AND (((owner_actor_id IS NULL) AND ((username)::text = 'drimsheet-core-ai'::text)) OR ((owner_actor_id IS NOT NULL) AND ((username)::text ~~ ('%@%/'::text || (agent_name)::text)))))`
    ),
    check('actors_version_ck', sql`version > 0`),
  ]
);

export const actorHistoryInAudit = audit.table(
  'actor_history',
  {
    id: bigserial({ mode: 'bigint' }).primaryKey().notNull(),
    actorEntityId: uuid('actor_entity_id').notNull(),
    actorId: uuid('actor_id').notNull(),
    onBehalfOf: uuid('on_behalf_of'),
    action: varchar({ length: 50 }).notNull(),
    diff: jsonb().notNull(),
    correlationId: varchar('correlation_id', { length: 255 }),
    occurredAt: timestamp('occurred_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index().using(
      'btree',
      table.actorEntityId.asc().nullsLast().op('int8_ops'),
      table.occurredAt.asc().nullsLast().op('uuid_ops'),
      table.id.asc().nullsLast().op('uuid_ops')
    ),
    index().using('btree', table.actorId.asc().nullsLast().op('uuid_ops')),
    index().using('btree', table.onBehalfOf.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.actorEntityId],
      foreignColumns: [actorsInCore.id],
      name: 'actor_history_actor_entity_id_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.actorId],
      foreignColumns: [actorsInCore.id],
      name: 'actor_history_actor_id_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.onBehalfOf],
      foreignColumns: [actorsInCore.id],
      name: 'actor_history_on_behalf_of_fkey',
    }).onDelete('restrict'),
  ]
);

export const usersInCore = core.table(
  'users',
  {
    actorId: uuid('actor_id').notNull(),
    createdBy: uuid('created_by').notNull(),
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    email: varchar({ length: 254 }).notNull(),
    emailVerified: boolean('email_verified').notNull(),
    version: integer().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index().using('btree', table.createdBy.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.actorId],
      foreignColumns: [actorsInCore.id],
      name: 'users_actor_id_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [actorsInCore.id],
      name: 'users_created_by_fkey',
    }).onDelete('restrict'),
    unique('users_actor_id_key').on(table.actorId),
    unique('users_email_key').on(table.email),
    check('users_version_positive_ck', sql`version > 0`),
  ]
);

export const userAuthInCore = core.table(
  'user_auth',
  {
    createdBy: uuid('created_by').notNull(),
    userId: uuid('user_id').primaryKey().notNull(),
    password: varchar({ length: 200 }),
    failedLoginAttempts: integer('failed_login_attempts').default(0),
    strategies: varchar({ length: 50 }).array().notNull(),
    version: integer().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index().using('btree', table.createdBy.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [actorsInCore.id],
      name: 'user_auth_created_by_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [usersInCore.id],
      name: 'user_auth_user_id_fkey',
    }).onDelete('cascade'),
    check('user_auth_version_positive_ck', sql`version > 0`),
  ]
);

export const userSessionsInCore = core.table(
  'user_sessions',
  {
    createdBy: uuid('created_by').notNull(),
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    userId: uuid('user_id').notNull(),
    refreshToken: text('refresh_token').notNull(),
    lastLoginAt: timestamp('last_login_at', {
      withTimezone: true,
      mode: 'string',
    }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index().using('btree', table.createdBy.asc().nullsLast().op('uuid_ops')),
    uniqueIndex('user_sessions_user_id_refresh_token_unique_index').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.refreshToken.asc().nullsLast().op('uuid_ops')
    ),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [actorsInCore.id],
      name: 'user_sessions_created_by_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [usersInCore.id],
      name: 'user_sessions_user_id_fkey',
    }).onDelete('cascade'),
    unique('user_sessions_refresh_token_key').on(table.refreshToken),
  ]
);

export const userProfileHistoryInAudit = audit.table(
  'user_profile_history',
  {
    id: bigserial({ mode: 'bigint' }).primaryKey().notNull(),
    userProfileId: uuid('user_profile_id').notNull(),
    actorId: uuid('actor_id').notNull(),
    onBehalfOf: uuid('on_behalf_of'),
    action: varchar({ length: 50 }).notNull(),
    diff: jsonb().notNull(),
    correlationId: varchar('correlation_id', { length: 255 }),
    occurredAt: timestamp('occurred_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index().using('btree', table.actorId.asc().nullsLast().op('uuid_ops')),
    index().using('btree', table.onBehalfOf.asc().nullsLast().op('uuid_ops')),
    index('user_profile_history_timeline_idx').using(
      'btree',
      table.userProfileId.asc().nullsLast().op('int8_ops'),
      table.occurredAt.desc().nullsFirst().op('int8_ops'),
      table.id.desc().nullsFirst().op('int8_ops')
    ),
    foreignKey({
      columns: [table.actorId],
      foreignColumns: [actorsInCore.id],
      name: 'user_profile_history_actor_id_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.onBehalfOf],
      foreignColumns: [actorsInCore.id],
      name: 'user_profile_history_on_behalf_of_fkey',
    }).onDelete('restrict'),
    check(
      'user_profile_history_diff_check',
      sql`(jsonb_typeof(diff) = 'object'::text) AND (diff ? 'before'::text) AND (diff ? 'after'::text) AND (((diff -> 'before'::text) <> 'null'::jsonb) OR ((diff -> 'after'::text) <> 'null'::jsonb))`
    ),
  ]
);

export const currenciesInCore = core.table(
  'currencies',
  {
    createdBy: uuid('created_by').notNull(),
    code: varchar({ length: 3 }).primaryKey().notNull(),
    symbol: varchar({ length: 5 }).notNull(),
    name: varchar({ length: 50 }).notNull(),
    minorUnit: smallint('minor_unit').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [actorsInCore.id],
      name: 'currencies_created_by_fkey',
    }).onDelete('restrict'),
  ]
);

export const currencyExchangeRatesInCore = core.table(
  'currency_exchange_rates',
  {
    createdBy: uuid('created_by').notNull(),
    id: bigserial({ mode: 'bigint' }).primaryKey().notNull(),
    currencyPair: varchar('currency_pair', { length: 7 }).notNull(),
    baseCurrencyCode: varchar('base_currency_code', { length: 3 }).notNull(),
    targetCurrencyCode: varchar('target_currency_code', {
      length: 3,
    }).notNull(),
    rate: numeric().notNull(),
    type: currencyExchangeRateTypeInCore().notNull(),
    asOf: date('as_of').notNull(),
    source: varchar({ length: 100 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.baseCurrencyCode],
      foreignColumns: [currenciesInCore.code],
      name: 'currency_exchange_rates_base_currency_code_fkey',
    }),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [actorsInCore.id],
      name: 'currency_exchange_rates_created_by_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.targetCurrencyCode],
      foreignColumns: [currenciesInCore.code],
      name: 'currency_exchange_rates_target_currency_code_fkey',
    }),
    unique('currency_exchange_rates_currency_pair_as_of_key').on(
      table.currencyPair,
      table.asOf
    ),
  ]
);

export const accountingStandardsInCore = core.table(
  'accounting_standards',
  {
    createdBy: uuid('created_by').notNull(),
    code: varchar({ length: 15 }).primaryKey().notNull(),
    name: varchar({ length: 100 }).notNull(),
    link: varchar({ length: 200 }),
    isSupported: boolean('is_supported').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [actorsInCore.id],
      name: 'accounting_standards_created_by_fkey',
    }).onDelete('restrict'),
  ]
);

export const jurisdictionsInCore = core.table(
  'jurisdictions',
  {
    createdBy: uuid('created_by').notNull(),
    code: varchar({ length: 2 }).primaryKey().notNull(),
    name: varchar({ length: 70 }).notNull(),
    currencyCode: varchar('currency_code', { length: 3 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [actorsInCore.id],
      name: 'jurisdictions_created_by_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.currencyCode],
      foreignColumns: [currenciesInCore.code],
      name: 'jurisdictions_currency_code_fkey',
    }).onDelete('restrict'),
  ]
);

export const accountingEntitiesInCore = core.table(
  'accounting_entities',
  {
    createdBy: uuid('created_by').notNull(),
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    type: accountingEntityTypeInCore().notNull(),
    name: varchar({ length: 255 }).notNull(),
    ownerId: uuid('owner_id').notNull(),
    functionalCurrencyCode: varchar('functional_currency_code', {
      length: 3,
    }).notNull(),
    jurisdictionCode: varchar('jurisdiction_code', { length: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index().using('btree', table.createdBy.asc().nullsLast().op('uuid_ops')),
    uniqueIndex('accounting_entities_unique_individual_owner_idx')
      .using('btree', table.ownerId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(type = 'individual'::accounting_entity_type)`),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [actorsInCore.id],
      name: 'accounting_entities_created_by_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.functionalCurrencyCode],
      foreignColumns: [currenciesInCore.code],
      name: 'accounting_entities_functional_currency_code_fkey',
    }),
    foreignKey({
      columns: [table.jurisdictionCode],
      foreignColumns: [jurisdictionsInCore.code],
      name: 'accounting_entities_jurisdiction_code_fkey',
    }),
    foreignKey({
      columns: [table.ownerId],
      foreignColumns: [usersInCore.id],
      name: 'accounting_entities_owner_id_fkey',
    }).onDelete('cascade'),
  ]
);

export const accountingEntityHistoryInAudit = audit.table(
  'accounting_entity_history',
  {
    id: bigserial({ mode: 'bigint' }).primaryKey().notNull(),
    accountingEntityId: uuid('accounting_entity_id').notNull(),
    actorId: uuid('actor_id').notNull(),
    onBehalfOf: uuid('on_behalf_of'),
    action: varchar({ length: 50 }).notNull(),
    diff: jsonb().notNull(),
    correlationId: varchar('correlation_id', { length: 255 }),
    occurredAt: timestamp('occurred_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index().using('btree', table.actorId.asc().nullsLast().op('uuid_ops')),
    index().using('btree', table.onBehalfOf.asc().nullsLast().op('uuid_ops')),
    index('accounting_entity_history_timeline_idx').using(
      'btree',
      table.accountingEntityId.asc().nullsLast().op('int8_ops'),
      table.occurredAt.desc().nullsFirst().op('int8_ops'),
      table.id.desc().nullsFirst().op('int8_ops')
    ),
    foreignKey({
      columns: [table.actorId],
      foreignColumns: [actorsInCore.id],
      name: 'accounting_entity_history_actor_id_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.onBehalfOf],
      foreignColumns: [actorsInCore.id],
      name: 'accounting_entity_history_on_behalf_of_fkey',
    }).onDelete('restrict'),
    check(
      'accounting_entity_history_diff_check',
      sql`(jsonb_typeof(diff) = 'object'::text) AND (diff ? 'before'::text) AND (diff ? 'after'::text) AND (((diff -> 'before'::text) <> 'null'::jsonb) OR ((diff -> 'after'::text) <> 'null'::jsonb))`
    ),
  ]
);

export const userPreferencesInCore = core.table(
  'user_preferences',
  {
    createdBy: uuid('created_by').notNull(),
    id: uuid().primaryKey().notNull(),
    appPreferences: jsonb('app_preferences'),
    lastActiveAccountingEntityId: uuid('last_active_accounting_entity_id'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [actorsInCore.id],
      name: 'user_preferences_created_by_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.id],
      foreignColumns: [usersInCore.id],
      name: 'user_preferences_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.lastActiveAccountingEntityId],
      foreignColumns: [accountingEntitiesInCore.id],
      name: 'user_preferences_last_active_accounting_entity_id_fkey',
    }).onDelete('set null'),
  ]
);

export const fiscalYearsInCore = core.table(
  'fiscal_years',
  {
    createdBy: uuid('created_by').notNull(),
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    name: varchar({ length: 150 }).notNull(),
    accountingEntityId: uuid('accounting_entity_id').notNull(),
    unit: fiscalYearPeriodUnitInCore().notNull(),
    count: smallint().notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    status: periodStatusInCore().notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true, mode: 'string' }),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.accountingEntityId],
      foreignColumns: [accountingEntitiesInCore.id],
      name: 'fiscal_years_accounting_entity_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [actorsInCore.id],
      name: 'fiscal_years_created_by_fkey',
    }).onDelete('restrict'),
  ]
);

export const fiscalYearHistoryInAudit = audit.table(
  'fiscal_year_history',
  {
    id: bigserial({ mode: 'bigint' }).primaryKey().notNull(),
    fiscalYearId: uuid('fiscal_year_id').notNull(),
    accountingEntityId: uuid('accounting_entity_id').notNull(),
    actorId: uuid('actor_id').notNull(),
    onBehalfOf: uuid('on_behalf_of'),
    action: varchar({ length: 50 }).notNull(),
    diff: jsonb().notNull(),
    correlationId: varchar('correlation_id', { length: 255 }),
    occurredAt: timestamp('occurred_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index().using('btree', table.actorId.asc().nullsLast().op('uuid_ops')),
    index().using('btree', table.onBehalfOf.asc().nullsLast().op('uuid_ops')),
    index('fiscal_year_history_tenant_timeline_idx').using(
      'btree',
      table.accountingEntityId.asc().nullsLast().op('int8_ops'),
      table.occurredAt.desc().nullsFirst().op('int8_ops'),
      table.id.desc().nullsFirst().op('uuid_ops')
    ),
    index('fiscal_year_history_timeline_idx').using(
      'btree',
      table.fiscalYearId.asc().nullsLast().op('int8_ops'),
      table.occurredAt.desc().nullsFirst().op('uuid_ops'),
      table.id.desc().nullsFirst().op('uuid_ops')
    ),
    foreignKey({
      columns: [table.actorId],
      foreignColumns: [actorsInCore.id],
      name: 'fiscal_year_history_actor_id_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.onBehalfOf],
      foreignColumns: [actorsInCore.id],
      name: 'fiscal_year_history_on_behalf_of_fkey',
    }).onDelete('restrict'),
    check(
      'fiscal_year_history_diff_check',
      sql`(jsonb_typeof(diff) = 'object'::text) AND (diff ? 'before'::text) AND (diff ? 'after'::text) AND (((diff -> 'before'::text) <> 'null'::jsonb) OR ((diff -> 'after'::text) <> 'null'::jsonb))`
    ),
  ]
);

export const accountingPeriodsInCore = core.table(
  'accounting_periods',
  {
    createdBy: uuid('created_by').notNull(),
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    name: varchar({ length: 150 }).notNull(),
    accountingEntityId: uuid('accounting_entity_id').notNull(),
    fiscalYearId: uuid('fiscal_year_id').notNull(),
    unit: periodUnitInCore().notNull(),
    count: smallint().notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    status: periodStatusInCore().notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true, mode: 'string' }),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.accountingEntityId],
      foreignColumns: [accountingEntitiesInCore.id],
      name: 'accounting_periods_accounting_entity_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [actorsInCore.id],
      name: 'accounting_periods_created_by_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.fiscalYearId],
      foreignColumns: [fiscalYearsInCore.id],
      name: 'accounting_periods_fiscal_year_id_fkey',
    }).onDelete('cascade'),
  ]
);

export const accountingPeriodHistoryInAudit = audit.table(
  'accounting_period_history',
  {
    id: bigserial({ mode: 'bigint' }).primaryKey().notNull(),
    accountingPeriodId: uuid('accounting_period_id').notNull(),
    accountingEntityId: uuid('accounting_entity_id').notNull(),
    actorId: uuid('actor_id').notNull(),
    onBehalfOf: uuid('on_behalf_of'),
    action: varchar({ length: 50 }).notNull(),
    diff: jsonb().notNull(),
    correlationId: varchar('correlation_id', { length: 255 }),
    occurredAt: timestamp('occurred_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index().using('btree', table.actorId.asc().nullsLast().op('uuid_ops')),
    index().using('btree', table.onBehalfOf.asc().nullsLast().op('uuid_ops')),
    index('accounting_period_history_tenant_timeline_idx').using(
      'btree',
      table.accountingEntityId.asc().nullsLast().op('int8_ops'),
      table.occurredAt.desc().nullsFirst().op('int8_ops'),
      table.id.desc().nullsFirst().op('uuid_ops')
    ),
    index('accounting_period_history_timeline_idx').using(
      'btree',
      table.accountingPeriodId.asc().nullsLast().op('int8_ops'),
      table.occurredAt.desc().nullsFirst().op('uuid_ops'),
      table.id.desc().nullsFirst().op('uuid_ops')
    ),
    foreignKey({
      columns: [table.actorId],
      foreignColumns: [actorsInCore.id],
      name: 'accounting_period_history_actor_id_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.onBehalfOf],
      foreignColumns: [actorsInCore.id],
      name: 'accounting_period_history_on_behalf_of_fkey',
    }).onDelete('restrict'),
    check(
      'accounting_period_history_diff_check',
      sql`(jsonb_typeof(diff) = 'object'::text) AND (diff ? 'before'::text) AND (diff ? 'after'::text) AND (((diff -> 'before'::text) <> 'null'::jsonb) OR ((diff -> 'after'::text) <> 'null'::jsonb))`
    ),
  ]
);

export const accountingContextsInCore = core.table(
  'accounting_contexts',
  {
    createdBy: uuid('created_by').notNull(),
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    name: varchar({ length: 150 }).notNull(),
    description: varchar({ length: 255 }),
    accountingEntityId: uuid('accounting_entity_id').notNull(),
    accountingStandardCode: varchar('accounting_standard_code', {
      length: 15,
    }).notNull(),
    fiscalYearId: uuid('fiscal_year_id').notNull(),
    currentOperatingPeriodId: uuid('current_operating_period_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    foreignKey({
      columns: [table.accountingEntityId],
      foreignColumns: [accountingEntitiesInCore.id],
      name: 'accounting_contexts_accounting_entity_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.accountingStandardCode],
      foreignColumns: [accountingStandardsInCore.code],
      name: 'accounting_contexts_accounting_standard_code_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [actorsInCore.id],
      name: 'accounting_contexts_created_by_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.currentOperatingPeriodId],
      foreignColumns: [accountingPeriodsInCore.id],
      name: 'accounting_contexts_current_operating_period_id_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.fiscalYearId],
      foreignColumns: [fiscalYearsInCore.id],
      name: 'accounting_contexts_fiscal_year_id_fkey',
    }).onDelete('cascade'),
  ]
);

export const accountingContextHistoryInAudit = audit.table(
  'accounting_context_history',
  {
    id: bigserial({ mode: 'bigint' }).primaryKey().notNull(),
    accountingContextId: uuid('accounting_context_id').notNull(),
    accountingEntityId: uuid('accounting_entity_id').notNull(),
    actorId: uuid('actor_id').notNull(),
    onBehalfOf: uuid('on_behalf_of'),
    action: varchar({ length: 50 }).notNull(),
    diff: jsonb().notNull(),
    correlationId: varchar('correlation_id', { length: 255 }),
    occurredAt: timestamp('occurred_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index().using('btree', table.actorId.asc().nullsLast().op('uuid_ops')),
    index().using('btree', table.onBehalfOf.asc().nullsLast().op('uuid_ops')),
    index('accounting_context_history_tenant_timeline_idx').using(
      'btree',
      table.accountingEntityId.asc().nullsLast().op('int8_ops'),
      table.occurredAt.desc().nullsFirst().op('int8_ops'),
      table.id.desc().nullsFirst().op('uuid_ops')
    ),
    index('accounting_context_history_timeline_idx').using(
      'btree',
      table.accountingContextId.asc().nullsLast().op('int8_ops'),
      table.occurredAt.desc().nullsFirst().op('uuid_ops'),
      table.id.desc().nullsFirst().op('uuid_ops')
    ),
    foreignKey({
      columns: [table.actorId],
      foreignColumns: [actorsInCore.id],
      name: 'accounting_context_history_actor_id_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.onBehalfOf],
      foreignColumns: [actorsInCore.id],
      name: 'accounting_context_history_on_behalf_of_fkey',
    }).onDelete('restrict'),
    check(
      'accounting_context_history_diff_check',
      sql`(jsonb_typeof(diff) = 'object'::text) AND (diff ? 'before'::text) AND (diff ? 'after'::text) AND (((diff -> 'before'::text) <> 'null'::jsonb) OR ((diff -> 'after'::text) <> 'null'::jsonb))`
    ),
  ]
);

export const reportingPeriodsInCore = core.table(
  'reporting_periods',
  {
    createdBy: uuid('created_by').notNull(),
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    name: varchar({ length: 150 }).notNull(),
    accountingEntityId: uuid('accounting_entity_id').notNull(),
    fiscalYearId: uuid('fiscal_year_id').notNull(),
    unit: periodUnitInCore().notNull(),
    count: smallint().notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.accountingEntityId],
      foreignColumns: [accountingEntitiesInCore.id],
      name: 'reporting_periods_accounting_entity_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [actorsInCore.id],
      name: 'reporting_periods_created_by_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.fiscalYearId],
      foreignColumns: [fiscalYearsInCore.id],
      name: 'reporting_periods_fiscal_year_id_fkey',
    }).onDelete('cascade'),
  ]
);

export const reportingPeriodHistoryInAudit = audit.table(
  'reporting_period_history',
  {
    id: bigserial({ mode: 'bigint' }).primaryKey().notNull(),
    reportingPeriodId: uuid('reporting_period_id').notNull(),
    accountingEntityId: uuid('accounting_entity_id').notNull(),
    actorId: uuid('actor_id').notNull(),
    onBehalfOf: uuid('on_behalf_of'),
    action: varchar({ length: 50 }).notNull(),
    diff: jsonb().notNull(),
    correlationId: varchar('correlation_id', { length: 255 }),
    occurredAt: timestamp('occurred_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index().using('btree', table.actorId.asc().nullsLast().op('uuid_ops')),
    index().using('btree', table.onBehalfOf.asc().nullsLast().op('uuid_ops')),
    index('reporting_period_history_tenant_timeline_idx').using(
      'btree',
      table.accountingEntityId.asc().nullsLast().op('int8_ops'),
      table.occurredAt.desc().nullsFirst().op('int8_ops'),
      table.id.desc().nullsFirst().op('uuid_ops')
    ),
    index('reporting_period_history_timeline_idx').using(
      'btree',
      table.reportingPeriodId.asc().nullsLast().op('int8_ops'),
      table.occurredAt.desc().nullsFirst().op('uuid_ops'),
      table.id.desc().nullsFirst().op('uuid_ops')
    ),
    foreignKey({
      columns: [table.actorId],
      foreignColumns: [actorsInCore.id],
      name: 'reporting_period_history_actor_id_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.onBehalfOf],
      foreignColumns: [actorsInCore.id],
      name: 'reporting_period_history_on_behalf_of_fkey',
    }).onDelete('restrict'),
    check(
      'reporting_period_history_diff_check',
      sql`(jsonb_typeof(diff) = 'object'::text) AND (diff ? 'before'::text) AND (diff ? 'after'::text) AND (((diff -> 'before'::text) <> 'null'::jsonb) OR ((diff -> 'after'::text) <> 'null'::jsonb))`
    ),
  ]
);

export const reportingContextsInCore = core.table(
  'reporting_contexts',
  {
    createdBy: uuid('created_by').notNull(),
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    name: varchar({ length: 150 }).notNull(),
    description: varchar({ length: 255 }),
    accountingEntityId: uuid('accounting_entity_id').notNull(),
    reportingCurrencyCode: varchar('reporting_currency_code', {
      length: 3,
    }).notNull(),
    accountingContextId: uuid('accounting_context_id').notNull(),
    currentReportingPeriodId: uuid('current_reporting_period_id').notNull(),
    accountingStandardCode: varchar('accounting_standard_code', {
      length: 15,
    }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    foreignKey({
      columns: [table.accountingContextId],
      foreignColumns: [accountingContextsInCore.id],
      name: 'reporting_contexts_accounting_context_id_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.accountingEntityId],
      foreignColumns: [accountingEntitiesInCore.id],
      name: 'reporting_contexts_accounting_entity_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.accountingStandardCode],
      foreignColumns: [accountingStandardsInCore.code],
      name: 'reporting_contexts_accounting_standard_code_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [actorsInCore.id],
      name: 'reporting_contexts_created_by_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.currentReportingPeriodId],
      foreignColumns: [reportingPeriodsInCore.id],
      name: 'reporting_contexts_current_reporting_period_id_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.reportingCurrencyCode],
      foreignColumns: [currenciesInCore.code],
      name: 'reporting_contexts_reporting_currency_code_fkey',
    }).onDelete('restrict'),
  ]
);

export const reportingContextHistoryInAudit = audit.table(
  'reporting_context_history',
  {
    id: bigserial({ mode: 'bigint' }).primaryKey().notNull(),
    reportingContextId: uuid('reporting_context_id').notNull(),
    accountingEntityId: uuid('accounting_entity_id').notNull(),
    actorId: uuid('actor_id').notNull(),
    onBehalfOf: uuid('on_behalf_of'),
    action: varchar({ length: 50 }).notNull(),
    diff: jsonb().notNull(),
    correlationId: varchar('correlation_id', { length: 255 }),
    occurredAt: timestamp('occurred_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index().using('btree', table.actorId.asc().nullsLast().op('uuid_ops')),
    index().using('btree', table.onBehalfOf.asc().nullsLast().op('uuid_ops')),
    index('reporting_context_history_tenant_timeline_idx').using(
      'btree',
      table.accountingEntityId.asc().nullsLast().op('int8_ops'),
      table.occurredAt.desc().nullsFirst().op('int8_ops'),
      table.id.desc().nullsFirst().op('uuid_ops')
    ),
    index('reporting_context_history_timeline_idx').using(
      'btree',
      table.reportingContextId.asc().nullsLast().op('int8_ops'),
      table.occurredAt.desc().nullsFirst().op('uuid_ops'),
      table.id.desc().nullsFirst().op('uuid_ops')
    ),
    foreignKey({
      columns: [table.actorId],
      foreignColumns: [actorsInCore.id],
      name: 'reporting_context_history_actor_id_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.onBehalfOf],
      foreignColumns: [actorsInCore.id],
      name: 'reporting_context_history_on_behalf_of_fkey',
    }).onDelete('restrict'),
    check(
      'reporting_context_history_diff_check',
      sql`(jsonb_typeof(diff) = 'object'::text) AND (diff ? 'before'::text) AND (diff ? 'after'::text) AND (((diff -> 'before'::text) <> 'null'::jsonb) OR ((diff -> 'after'::text) <> 'null'::jsonb))`
    ),
  ]
);

export const ledgerAccountsInCore = core.table(
  'ledger_accounts',
  {
    createdBy: uuid('created_by').notNull(),
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    code: varchar({ length: 6 }).notNull(),
    materializedPath: varchar('materialized_path', { length: 100 }).notNull(),
    accountingEntityId: uuid('accounting_entity_id').notNull(),
    type: ledgerTypeInCore().notNull(),
    normalBalance: normalBalanceTypeInCore('normal_balance').notNull(),
    subType: varchar('sub_type').notNull(),
    behavior: varchar().notNull(),
    isControlAccount: boolean('is_control_account').default(false).notNull(),
    controlAccountId: uuid('control_account_id'),
    name: varchar({ length: 100 }).notNull(),
    currencyCode: varchar('currency_code', { length: 3 }),
    status: ledgerAccountStatusInCore().notNull(),
    contraAccountRule: contraAccountRuleInCore('contra_account_rule').notNull(),
    adjunctAccountRule: adjunctAccountRuleInCore(
      'adjunct_account_rule'
    ).notNull(),
    openingBalanceDate: date('opening_balance_date'),
    meta: jsonb(),
    version: integer().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    foreignKey({
      columns: [table.accountingEntityId],
      foreignColumns: [accountingEntitiesInCore.id],
      name: 'ledger_accounts_accounting_entity_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.controlAccountId],
      foreignColumns: [table.id],
      name: 'ledger_accounts_control_account_id_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [actorsInCore.id],
      name: 'ledger_accounts_created_by_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.currencyCode],
      foreignColumns: [currenciesInCore.code],
      name: 'ledger_accounts_currency_code_fkey',
    }).onDelete('restrict'),
    unique('ledger_accounts_code_accounting_entity_id_uk').on(
      table.code,
      table.accountingEntityId
    ),
    unique('ledger_accounts_path_accounting_entity_id_uk').on(
      table.materializedPath,
      table.accountingEntityId
    ),
    check('ledger_accounts_version_positive_ck', sql`version > 0`),
  ]
);

export const ledgerAccountHistoryInAudit = audit.table(
  'ledger_account_history',
  {
    id: bigserial({ mode: 'bigint' }).primaryKey().notNull(),
    ledgerAccountId: uuid('ledger_account_id').notNull(),
    accountingEntityId: uuid('accounting_entity_id').notNull(),
    actorId: uuid('actor_id').notNull(),
    onBehalfOf: uuid('on_behalf_of'),
    action: varchar({ length: 50 }).notNull(),
    diff: jsonb().notNull(),
    correlationId: varchar('correlation_id', { length: 255 }),
    occurredAt: timestamp('occurred_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index().using('btree', table.actorId.asc().nullsLast().op('uuid_ops')),
    index().using('btree', table.onBehalfOf.asc().nullsLast().op('uuid_ops')),
    index('ledger_account_history_tenant_timeline_idx').using(
      'btree',
      table.accountingEntityId.asc().nullsLast().op('int8_ops'),
      table.occurredAt.desc().nullsFirst().op('int8_ops'),
      table.id.desc().nullsFirst().op('uuid_ops')
    ),
    index('ledger_account_history_timeline_idx').using(
      'btree',
      table.ledgerAccountId.asc().nullsLast().op('int8_ops'),
      table.occurredAt.desc().nullsFirst().op('uuid_ops'),
      table.id.desc().nullsFirst().op('uuid_ops')
    ),
    foreignKey({
      columns: [table.actorId],
      foreignColumns: [actorsInCore.id],
      name: 'ledger_account_history_actor_id_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.onBehalfOf],
      foreignColumns: [actorsInCore.id],
      name: 'ledger_account_history_on_behalf_of_fkey',
    }).onDelete('restrict'),
    check(
      'ledger_account_history_diff_check',
      sql`(jsonb_typeof(diff) = 'object'::text) AND (diff ? 'before'::text) AND (diff ? 'after'::text) AND (((diff -> 'before'::text) <> 'null'::jsonb) OR ((diff -> 'after'::text) <> 'null'::jsonb))`
    ),
  ]
);

export const ledgerAccountBalancesInCore = core.table(
  'ledger_account_balances',
  {
    createdBy: uuid('created_by').notNull(),
    ledgerAccountId: uuid('ledger_account_id').primaryKey().notNull(),
    accountingEntityId: uuid('accounting_entity_id').notNull(),
    accountMaterializedPath: varchar('account_materialized_path', {
      length: 100,
    }).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    amount: bigint({ mode: 'number' }).default(0).notNull(),
    currencyCode: varchar('currency_code', { length: 3 }).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    functionalAmount: bigint('functional_amount', { mode: 'number' })
      .default(0)
      .notNull(),
    functionalCurrencyCode: varchar('functional_currency_code', {
      length: 3,
    }).notNull(),
    version: integer().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.accountingEntityId],
      foreignColumns: [accountingEntitiesInCore.id],
      name: 'ledger_account_balances_accounting_entity_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [actorsInCore.id],
      name: 'ledger_account_balances_created_by_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.currencyCode],
      foreignColumns: [currenciesInCore.code],
      name: 'ledger_account_balances_currency_code_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.functionalCurrencyCode],
      foreignColumns: [currenciesInCore.code],
      name: 'ledger_account_balances_functional_currency_code_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.ledgerAccountId],
      foreignColumns: [ledgerAccountsInCore.id],
      name: 'ledger_account_balances_ledger_account_id_fkey',
    }).onDelete('cascade'),
    unique('ledger_account_balances_path_entity_id_uk').on(
      table.accountingEntityId,
      table.accountMaterializedPath
    ),
  ]
);

export const counterpartiesInCore = core.table(
  'counterparties',
  {
    createdBy: uuid('created_by').notNull(),
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    accountingEntityId: uuid('accounting_entity_id').notNull(),
    name: varchar({ length: 255 }).notNull(),
    status: counterPartyStatusInCore().notNull(),
    type: counterPartyTypeInCore().notNull(),
    version: integer().default(1).notNull(),
    meta: jsonb().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('counterparties_accounting_entity_id_idx').using(
      'btree',
      table.accountingEntityId.asc().nullsLast().op('uuid_ops')
    ),
    foreignKey({
      columns: [table.accountingEntityId],
      foreignColumns: [accountingEntitiesInCore.id],
      name: 'counterparties_accounting_entity_id_fkey',
    }),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [actorsInCore.id],
      name: 'counterparties_created_by_fkey',
    }).onDelete('restrict'),
    check(
      'counterparties_contractor_meta_check',
      sql`(NOT (meta ? 'contractor'::text)) OR COALESCE((jsonb_typeof((meta -> 'contractor'::text)) = 'object'::text), false)`
    ),
    check(
      'counterparties_employer_meta_check',
      sql`(NOT (meta ? 'employer'::text)) OR COALESCE((jsonb_typeof((meta -> 'employer'::text)) = 'object'::text), false)`
    ),
    check(
      'counterparties_meta_check',
      sql`(jsonb_typeof(meta) = 'object'::text) AND ((meta - ARRAY['employer'::text, 'vendor'::text, 'contractor'::text]) = '{}'::jsonb)`
    ),
    check(
      'counterparties_vendor_meta_check',
      sql`(NOT (meta ? 'vendor'::text)) OR COALESCE((jsonb_typeof((meta -> 'vendor'::text)) = 'object'::text), false)`
    ),
  ]
);

export const counterpartyHistoryInAudit = audit.table(
  'counterparty_history',
  {
    id: bigserial({ mode: 'bigint' }).primaryKey().notNull(),
    counterpartyId: uuid('counterparty_id').notNull(),
    accountingEntityId: uuid('accounting_entity_id').notNull(),
    actorId: uuid('actor_id').notNull(),
    onBehalfOf: uuid('on_behalf_of'),
    entityVersion: integer('entity_version').notNull(),
    action: varchar({ length: 50 }).notNull(),
    diff: jsonb().notNull(),
    correlationId: varchar('correlation_id', { length: 255 }),
    occurredAt: timestamp('occurred_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index().using('btree', table.actorId.asc().nullsLast().op('uuid_ops')),
    index().using('btree', table.onBehalfOf.asc().nullsLast().op('uuid_ops')),
    index('counterparty_history_tenant_timeline_idx').using(
      'btree',
      table.accountingEntityId.asc().nullsLast().op('int8_ops'),
      table.occurredAt.desc().nullsFirst().op('int8_ops'),
      table.id.desc().nullsFirst().op('uuid_ops')
    ),
    index('counterparty_history_timeline_idx').using(
      'btree',
      table.counterpartyId.asc().nullsLast().op('int8_ops'),
      table.occurredAt.desc().nullsFirst().op('uuid_ops'),
      table.id.desc().nullsFirst().op('uuid_ops')
    ),
    foreignKey({
      columns: [table.actorId],
      foreignColumns: [actorsInCore.id],
      name: 'counterparty_history_actor_id_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.onBehalfOf],
      foreignColumns: [actorsInCore.id],
      name: 'counterparty_history_on_behalf_of_fkey',
    }).onDelete('restrict'),
    check(
      'counterparty_history_diff_check',
      sql`(jsonb_typeof(diff) = 'object'::text) AND (diff ? 'before'::text) AND (diff ? 'after'::text) AND (((diff -> 'before'::text) <> 'null'::jsonb) OR ((diff -> 'after'::text) <> 'null'::jsonb))`
    ),
  ]
);

export const journalEntriesInCore = core.table(
  'journal_entries',
  {
    createdBy: uuid('created_by').notNull(),
    id: uuid().primaryKey().notNull(),
    accountingEntityId: uuid('accounting_entity_id').notNull(),
    sourceType: journalEntrySourceTypeInCore('source_type').notNull(),
    memo: varchar({ length: 100 }),
    status: journalEntryStatusInCore().notNull(),
    effectiveDate: date('effective_date').notNull(),
    postedAt: timestamp('posted_at', { withTimezone: true, mode: 'string' }),
    voidedAt: timestamp('voided_at', { withTimezone: true, mode: 'string' }),
    voidingEntryId: uuid('voiding_entry_id'),
    version: integer().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.accountingEntityId],
      foreignColumns: [accountingEntitiesInCore.id],
      name: 'journal_entries_accounting_entity_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [actorsInCore.id],
      name: 'journal_entries_created_by_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.voidingEntryId],
      foreignColumns: [table.id],
      name: 'journal_entries_voiding_entry_id_fkey',
    }),
    unique('journal_entries_voiding_entry_id_key').on(table.voidingEntryId),
  ]
);

export const journalEntryHistoryInAudit = audit.table(
  'journal_entry_history',
  {
    id: bigserial({ mode: 'bigint' }).primaryKey().notNull(),
    journalEntryId: uuid('journal_entry_id').notNull(),
    accountingEntityId: uuid('accounting_entity_id').notNull(),
    actorId: uuid('actor_id').notNull(),
    onBehalfOf: uuid('on_behalf_of'),
    action: varchar({ length: 50 }).notNull(),
    diff: jsonb().notNull(),
    correlationId: varchar('correlation_id', { length: 255 }),
    entityVersion: integer('entity_version'),
    occurredAt: timestamp('occurred_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index().using('btree', table.actorId.asc().nullsLast().op('uuid_ops')),
    index().using('btree', table.onBehalfOf.asc().nullsLast().op('uuid_ops')),
    index('journal_entry_history_tenant_timeline_idx').using(
      'btree',
      table.accountingEntityId.asc().nullsLast().op('int8_ops'),
      table.occurredAt.desc().nullsFirst().op('int8_ops'),
      table.id.desc().nullsFirst().op('uuid_ops')
    ),
    index('journal_entry_history_timeline_idx').using(
      'btree',
      table.journalEntryId.asc().nullsLast().op('int8_ops'),
      table.occurredAt.desc().nullsFirst().op('uuid_ops'),
      table.id.desc().nullsFirst().op('uuid_ops')
    ),
    foreignKey({
      columns: [table.actorId],
      foreignColumns: [actorsInCore.id],
      name: 'journal_entry_history_actor_id_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.onBehalfOf],
      foreignColumns: [actorsInCore.id],
      name: 'journal_entry_history_on_behalf_of_fkey',
    }).onDelete('restrict'),
    check(
      'journal_entry_history_diff_check',
      sql`(jsonb_typeof(diff) = 'object'::text) AND (diff ? 'before'::text) AND (diff ? 'after'::text) AND (((diff -> 'before'::text) <> 'null'::jsonb) OR ((diff -> 'after'::text) <> 'null'::jsonb))`
    ),
  ]
);

export const journalEntryAttachmentsInCore = core.table(
  'journal_entry_attachments',
  {
    journalEntryId: uuid('journal_entry_id').primaryKey().notNull(),
    data: jsonb().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.journalEntryId],
      foreignColumns: [journalEntriesInCore.id],
      name: 'journal_entry_attachments_journal_entry_id_fkey',
    }).onDelete('cascade'),
  ]
);

export const journalLinesInCore = core.table(
  'journal_lines',
  {
    createdBy: uuid('created_by').notNull(),
    id: uuid().primaryKey().notNull(),
    entryId: uuid('entry_id').notNull(),
    accountId: uuid('account_id').notNull(),
    counterpartyId: uuid('counterparty_id'),
    sequenceOrder: integer('sequence_order').notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    amount: bigint({ mode: 'number' }).notNull(),
    currencyCode: varchar('currency_code', { length: 3 }).notNull(),
    exchangeRate: jsonb('exchange_rate'),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    functionalAmount: bigint('functional_amount', { mode: 'number' }).notNull(),
    functionalCurrencyCode: varchar('functional_currency_code', {
      length: 3,
    }).notNull(),
    side: journalSideInCore().notNull(),
    description: varchar({ length: 100 }),
    meta: jsonb(),
    version: integer().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('journal_lines_counterparty_entry_idx').using(
      'btree',
      table.counterpartyId.asc().nullsLast().op('uuid_ops'),
      table.entryId.asc().nullsLast().op('uuid_ops')
    ),
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [ledgerAccountsInCore.id],
      name: 'journal_lines_account_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.counterpartyId],
      foreignColumns: [counterpartiesInCore.id],
      name: 'journal_lines_counterparty_id_fkey',
    }),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [actorsInCore.id],
      name: 'journal_lines_created_by_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.currencyCode],
      foreignColumns: [currenciesInCore.code],
      name: 'journal_lines_currency_code_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.entryId],
      foreignColumns: [journalEntriesInCore.id],
      name: 'journal_lines_entry_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.functionalCurrencyCode],
      foreignColumns: [currenciesInCore.code],
      name: 'journal_lines_functional_currency_code_fkey',
    }).onDelete('restrict'),
  ]
);

export const journalLineHistoryInAudit = audit.table(
  'journal_line_history',
  {
    id: bigserial({ mode: 'bigint' }).primaryKey().notNull(),
    journalLineId: uuid('journal_line_id').notNull(),
    journalEntryId: uuid('journal_entry_id').notNull(),
    accountingEntityId: uuid('accounting_entity_id').notNull(),
    actorId: uuid('actor_id').notNull(),
    onBehalfOf: uuid('on_behalf_of'),
    action: varchar({ length: 50 }).notNull(),
    diff: jsonb().notNull(),
    correlationId: varchar('correlation_id', { length: 255 }),
    entityVersion: integer('entity_version'),
    occurredAt: timestamp('occurred_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index().using('btree', table.actorId.asc().nullsLast().op('uuid_ops')),
    index('journal_line_history_entry_timeline_idx').using(
      'btree',
      table.journalEntryId.asc().nullsLast().op('int8_ops'),
      table.occurredAt.desc().nullsFirst().op('timestamptz_ops'),
      table.id.desc().nullsFirst().op('timestamptz_ops')
    ),
    index().using('btree', table.onBehalfOf.asc().nullsLast().op('uuid_ops')),
    index('journal_line_history_tenant_timeline_idx').using(
      'btree',
      table.accountingEntityId.asc().nullsLast().op('int8_ops'),
      table.occurredAt.desc().nullsFirst().op('uuid_ops'),
      table.id.desc().nullsFirst().op('uuid_ops')
    ),
    index('journal_line_history_timeline_idx').using(
      'btree',
      table.journalLineId.asc().nullsLast().op('uuid_ops'),
      table.occurredAt.desc().nullsFirst().op('uuid_ops'),
      table.id.desc().nullsFirst().op('int8_ops')
    ),
    foreignKey({
      columns: [table.actorId],
      foreignColumns: [actorsInCore.id],
      name: 'journal_line_history_actor_id_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.onBehalfOf],
      foreignColumns: [actorsInCore.id],
      name: 'journal_line_history_on_behalf_of_fkey',
    }).onDelete('restrict'),
    check(
      'journal_line_history_diff_check',
      sql`(jsonb_typeof(diff) = 'object'::text) AND (diff ? 'before'::text) AND (diff ? 'after'::text) AND (((diff -> 'before'::text) <> 'null'::jsonb) OR ((diff -> 'after'::text) <> 'null'::jsonb))`
    ),
  ]
);

export const ledgerAccountBalanceAdjustmentsInCore = core.table(
  'ledger_account_balance_adjustments',
  {
    createdBy: uuid('created_by').notNull(),
    id: uuid().defaultRandom().primaryKey().notNull(),
    ledgerAccountId: uuid('ledger_account_id').notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    amount: bigint({ mode: 'number' }).notNull(),
    currencyCode: varchar('currency_code', { length: 3 }).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    functionalAmount: bigint('functional_amount', { mode: 'number' }).notNull(),
    functionalCurrencyCode: varchar('functional_currency_code', {
      length: 3,
    }).notNull(),
    journalEntryId: uuid('journal_entry_id').notNull(),
    effect: ledgerAccountBalanceEffectInCore().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.functionalCurrencyCode],
      foreignColumns: [currenciesInCore.code],
      name: 'ledger_account_balance_adjustment_functional_currency_code_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [actorsInCore.id],
      name: 'ledger_account_balance_adjustments_created_by_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.currencyCode],
      foreignColumns: [currenciesInCore.code],
      name: 'ledger_account_balance_adjustments_currency_code_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.journalEntryId],
      foreignColumns: [journalEntriesInCore.id],
      name: 'ledger_account_balance_adjustments_journal_entry_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.ledgerAccountId],
      foreignColumns: [ledgerAccountsInCore.id],
      name: 'ledger_account_balance_adjustments_ledger_account_id_fkey',
    }).onDelete('cascade'),
    unique('ledger_account_balance_adjustments_account_entry_uk').on(
      table.ledgerAccountId,
      table.journalEntryId
    ),
  ]
);

export const subledgerFxCostBasisLotsInCore = core.table(
  'subledger_fx_cost_basis_lots',
  {
    createdBy: uuid('created_by').notNull(),
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    ledgerAccountId: uuid('ledger_account_id').notNull(),
    accountingEntityId: uuid('accounting_entity_id').notNull(),
    status: subledgerFxCostBasisLotStatusInCore().notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    originalQuantityAmount: bigint('original_quantity_amount', {
      mode: 'number',
    }).notNull(),
    originalQuantityCurrency: varchar('original_quantity_currency', {
      length: 3,
    }).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    remainingQuantityAmount: bigint('remaining_quantity_amount', {
      mode: 'number',
    }).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    costBasisAmount: bigint('cost_basis_amount', { mode: 'number' }).notNull(),
    costBasisCurrency: varchar('cost_basis_currency', { length: 3 }).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    remainingCostBasisAmount: bigint('remaining_cost_basis_amount', {
      mode: 'number',
    }).notNull(),
    acquisitionRate: jsonb('acquisition_rate').notNull(),
    acquisitionDate: timestamp('acquisition_date', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    version: integer().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('subledger_fx_cost_basis_lots_fifo_idx').using(
      'btree',
      table.accountingEntityId.asc().nullsLast().op('timestamptz_ops'),
      table.ledgerAccountId.asc().nullsLast().op('enum_ops'),
      table.status.asc().nullsLast().op('uuid_ops'),
      table.acquisitionDate.asc().nullsLast().op('uuid_ops'),
      table.createdAt.asc().nullsLast().op('uuid_ops'),
      table.id.asc().nullsLast().op('enum_ops')
    ),
    foreignKey({
      columns: [table.accountingEntityId],
      foreignColumns: [accountingEntitiesInCore.id],
      name: 'subledger_fx_cost_basis_lots_accounting_entity_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.costBasisCurrency],
      foreignColumns: [currenciesInCore.code],
      name: 'subledger_fx_cost_basis_lots_cost_basis_currency_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [actorsInCore.id],
      name: 'subledger_fx_cost_basis_lots_created_by_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.ledgerAccountId],
      foreignColumns: [ledgerAccountsInCore.id],
      name: 'subledger_fx_cost_basis_lots_ledger_account_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.originalQuantityCurrency],
      foreignColumns: [currenciesInCore.code],
      name: 'subledger_fx_cost_basis_lots_original_quantity_currency_fkey',
    }).onDelete('restrict'),
  ]
);

export const subledgerFxCostBasisLotHistoryInAudit = audit.table(
  'subledger_fx_cost_basis_lot_history',
  {
    id: bigserial({ mode: 'bigint' }).primaryKey().notNull(),
    lotId: uuid('lot_id').notNull(),
    accountingEntityId: uuid('accounting_entity_id').notNull(),
    actorId: uuid('actor_id').notNull(),
    onBehalfOf: uuid('on_behalf_of'),
    action: varchar({ length: 50 }).notNull(),
    diff: jsonb().notNull(),
    correlationId: varchar('correlation_id', { length: 255 }),
    occurredAt: timestamp('occurred_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index().using('btree', table.actorId.asc().nullsLast().op('uuid_ops')),
    index().using('btree', table.onBehalfOf.asc().nullsLast().op('uuid_ops')),
    index('subledger_fx_cost_basis_lot_history_tenant_timeline_idx').using(
      'btree',
      table.accountingEntityId.asc().nullsLast().op('int8_ops'),
      table.occurredAt.desc().nullsFirst().op('int8_ops'),
      table.id.desc().nullsFirst().op('uuid_ops')
    ),
    index('subledger_fx_cost_basis_lot_history_timeline_idx').using(
      'btree',
      table.lotId.asc().nullsLast().op('int8_ops'),
      table.occurredAt.desc().nullsFirst().op('uuid_ops'),
      table.id.desc().nullsFirst().op('uuid_ops')
    ),
    foreignKey({
      columns: [table.actorId],
      foreignColumns: [actorsInCore.id],
      name: 'subledger_fx_cost_basis_lot_history_actor_id_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.onBehalfOf],
      foreignColumns: [actorsInCore.id],
      name: 'subledger_fx_cost_basis_lot_history_on_behalf_of_fkey',
    }).onDelete('restrict'),
    check(
      'subledger_fx_cost_basis_lot_history_diff_check',
      sql`(jsonb_typeof(diff) = 'object'::text) AND (diff ? 'before'::text) AND (diff ? 'after'::text) AND (((diff -> 'before'::text) <> 'null'::jsonb) OR ((diff -> 'after'::text) <> 'null'::jsonb))`
    ),
  ]
);

export const subledgerFxCostBasisLotAcquisitionsInCore = core.table(
  'subledger_fx_cost_basis_lot_acquisitions',
  {
    createdBy: uuid('created_by').notNull(),
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    ledgerAccountId: uuid('ledger_account_id').notNull(),
    accountingEntityId: uuid('accounting_entity_id').notNull(),
    lotId: uuid('lot_id').notNull(),
    journalEntryId: uuid('journal_entry_id').notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    quantityAmount: bigint('quantity_amount', { mode: 'number' }).notNull(),
    quantityCurrency: varchar('quantity_currency', { length: 3 }).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    costBasisAmount: bigint('cost_basis_amount', { mode: 'number' }).notNull(),
    costBasisCurrency: varchar('cost_basis_currency', { length: 3 }).notNull(),
    acquisitionRate: jsonb('acquisition_rate').notNull(),
    acquisitionDate: date('acquisition_date').notNull(),
    officialRate: jsonb('official_rate'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.accountingEntityId],
      foreignColumns: [accountingEntitiesInCore.id],
      name: 'subledger_fx_cost_basis_lot_acquisiti_accounting_entity_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.costBasisCurrency],
      foreignColumns: [currenciesInCore.code],
      name: 'subledger_fx_cost_basis_lot_acquisitio_cost_basis_currency_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [actorsInCore.id],
      name: 'subledger_fx_cost_basis_lot_acquisitions_created_by_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.journalEntryId],
      foreignColumns: [journalEntriesInCore.id],
      name: 'subledger_fx_cost_basis_lot_acquisitions_journal_entry_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.ledgerAccountId],
      foreignColumns: [ledgerAccountsInCore.id],
      name: 'subledger_fx_cost_basis_lot_acquisitions_ledger_account_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.lotId],
      foreignColumns: [subledgerFxCostBasisLotsInCore.id],
      name: 'subledger_fx_cost_basis_lot_acquisitions_lot_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.quantityCurrency],
      foreignColumns: [currenciesInCore.code],
      name: 'subledger_fx_cost_basis_lot_acquisitions_quantity_currency_fkey',
    }).onDelete('restrict'),
  ]
);

export const subledgerFxCostBasisLotAcquisitionHistoryInAudit = audit.table(
  'subledger_fx_cost_basis_lot_acquisition_history',
  {
    id: bigserial({ mode: 'bigint' }).primaryKey().notNull(),
    acquisitionId: uuid('acquisition_id').notNull(),
    lotId: uuid('lot_id').notNull(),
    accountingEntityId: uuid('accounting_entity_id').notNull(),
    actorId: uuid('actor_id').notNull(),
    onBehalfOf: uuid('on_behalf_of'),
    action: varchar({ length: 50 }).notNull(),
    diff: jsonb().notNull(),
    correlationId: varchar('correlation_id', { length: 255 }),
    occurredAt: timestamp('occurred_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index().using('btree', table.actorId.asc().nullsLast().op('uuid_ops')),
    index(
      'subledger_fx_cost_basis_lot_acquisition_history_on_behalf_of_in'
    ).using('btree', table.onBehalfOf.asc().nullsLast().op('uuid_ops')),
    index(
      'subledger_fx_cost_basis_lot_acquisition_history_tenant_timeline'
    ).using(
      'btree',
      table.accountingEntityId.asc().nullsLast().op('int8_ops'),
      table.occurredAt.desc().nullsFirst().op('int8_ops'),
      table.id.desc().nullsFirst().op('uuid_ops')
    ),
    index('subledger_fx_cost_basis_lot_acquisition_history_timeline_idx').using(
      'btree',
      table.acquisitionId.asc().nullsLast().op('int8_ops'),
      table.occurredAt.desc().nullsFirst().op('uuid_ops'),
      table.id.desc().nullsFirst().op('uuid_ops')
    ),
    foreignKey({
      columns: [table.onBehalfOf],
      foreignColumns: [actorsInCore.id],
      name: 'subledger_fx_cost_basis_lot_acquisition_histo_on_behalf_of_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.actorId],
      foreignColumns: [actorsInCore.id],
      name: 'subledger_fx_cost_basis_lot_acquisition_history_actor_id_fkey',
    }).onDelete('restrict'),
    check(
      'subledger_fx_cost_basis_lot_acquisition_history_diff_check',
      sql`(jsonb_typeof(diff) = 'object'::text) AND (diff ? 'before'::text) AND (diff ? 'after'::text) AND (((diff -> 'before'::text) <> 'null'::jsonb) OR ((diff -> 'after'::text) <> 'null'::jsonb))`
    ),
  ]
);

export const subledgerFxCostBasisLotDispositionsInCore = core.table(
  'subledger_fx_cost_basis_lot_dispositions',
  {
    createdBy: uuid('created_by').notNull(),
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    ledgerAccountId: uuid('ledger_account_id').notNull(),
    accountingEntityId: uuid('accounting_entity_id').notNull(),
    journalEntryId: uuid('journal_entry_id').notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    quantityAmount: bigint('quantity_amount', { mode: 'number' }).notNull(),
    quantityCurrency: varchar('quantity_currency', { length: 3 }).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    costBasisConsumedAmount: bigint('cost_basis_consumed_amount', {
      mode: 'number',
    }).notNull(),
    costBasisConsumedCurrency: varchar('cost_basis_consumed_currency', {
      length: 3,
    }).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    proceedsAmount: bigint('proceeds_amount', { mode: 'number' }).notNull(),
    proceedsCurrency: varchar('proceeds_currency', { length: 3 }).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    realizedGainLossAmount: bigint('realized_gain_loss_amount', {
      mode: 'number',
    }).notNull(),
    realizedGainLossCurrency: varchar('realized_gain_loss_currency', {
      length: 3,
    }).notNull(),
    dispositionRate: jsonb('disposition_rate').notNull(),
    officialRate: jsonb('official_rate'),
    dispositionDate: date('disposition_date').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.costBasisConsumedCurrency],
      foreignColumns: [currenciesInCore.code],
      name: 'subledger_fx_cost_basis_lot_d_cost_basis_consumed_currency_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.realizedGainLossCurrency],
      foreignColumns: [currenciesInCore.code],
      name: 'subledger_fx_cost_basis_lot_di_realized_gain_loss_currency_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.accountingEntityId],
      foreignColumns: [accountingEntitiesInCore.id],
      name: 'subledger_fx_cost_basis_lot_dispositi_accounting_entity_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [actorsInCore.id],
      name: 'subledger_fx_cost_basis_lot_dispositions_created_by_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.journalEntryId],
      foreignColumns: [journalEntriesInCore.id],
      name: 'subledger_fx_cost_basis_lot_dispositions_journal_entry_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.ledgerAccountId],
      foreignColumns: [ledgerAccountsInCore.id],
      name: 'subledger_fx_cost_basis_lot_dispositions_ledger_account_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.proceedsCurrency],
      foreignColumns: [currenciesInCore.code],
      name: 'subledger_fx_cost_basis_lot_dispositions_proceeds_currency_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.quantityCurrency],
      foreignColumns: [currenciesInCore.code],
      name: 'subledger_fx_cost_basis_lot_dispositions_quantity_currency_fkey',
    }).onDelete('restrict'),
  ]
);

export const subledgerFxCostBasisLotDispositionHistoryInAudit = audit.table(
  'subledger_fx_cost_basis_lot_disposition_history',
  {
    id: bigserial({ mode: 'bigint' }).primaryKey().notNull(),
    dispositionId: uuid('disposition_id').notNull(),
    accountingEntityId: uuid('accounting_entity_id').notNull(),
    actorId: uuid('actor_id').notNull(),
    onBehalfOf: uuid('on_behalf_of'),
    action: varchar({ length: 50 }).notNull(),
    diff: jsonb().notNull(),
    correlationId: varchar('correlation_id', { length: 255 }),
    occurredAt: timestamp('occurred_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index().using('btree', table.actorId.asc().nullsLast().op('uuid_ops')),
    index(
      'subledger_fx_cost_basis_lot_disposition_history_on_behalf_of_in'
    ).using('btree', table.onBehalfOf.asc().nullsLast().op('uuid_ops')),
    index(
      'subledger_fx_cost_basis_lot_disposition_history_tenant_timeline'
    ).using(
      'btree',
      table.accountingEntityId.asc().nullsLast().op('int8_ops'),
      table.occurredAt.desc().nullsFirst().op('int8_ops'),
      table.id.desc().nullsFirst().op('uuid_ops')
    ),
    index('subledger_fx_cost_basis_lot_disposition_history_timeline_idx').using(
      'btree',
      table.dispositionId.asc().nullsLast().op('int8_ops'),
      table.occurredAt.desc().nullsFirst().op('uuid_ops'),
      table.id.desc().nullsFirst().op('uuid_ops')
    ),
    foreignKey({
      columns: [table.onBehalfOf],
      foreignColumns: [actorsInCore.id],
      name: 'subledger_fx_cost_basis_lot_disposition_histo_on_behalf_of_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.actorId],
      foreignColumns: [actorsInCore.id],
      name: 'subledger_fx_cost_basis_lot_disposition_history_actor_id_fkey',
    }).onDelete('restrict'),
    check(
      'subledger_fx_cost_basis_lot_disposition_history_diff_check',
      sql`(jsonb_typeof(diff) = 'object'::text) AND (diff ? 'before'::text) AND (diff ? 'after'::text) AND (((diff -> 'before'::text) <> 'null'::jsonb) OR ((diff -> 'after'::text) <> 'null'::jsonb))`
    ),
  ]
);

export const subledgerFxCostBasisLotDispositionAllocationsInCore = core.table(
  'subledger_fx_cost_basis_lot_disposition_allocations',
  {
    createdBy: uuid('created_by').notNull(),
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    dispositionId: uuid('disposition_id').notNull(),
    lotId: uuid('lot_id').notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    quantityAmount: bigint('quantity_amount', { mode: 'number' }).notNull(),
    quantityCurrency: varchar('quantity_currency', { length: 3 }).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    costBasisConsumedAmount: bigint('cost_basis_consumed_amount', {
      mode: 'number',
    }).notNull(),
    costBasisConsumedCurrency: varchar('cost_basis_consumed_currency', {
      length: 3,
    }).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    proceedsAmount: bigint('proceeds_amount', { mode: 'number' }).notNull(),
    proceedsCurrency: varchar('proceeds_currency', { length: 3 }).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    realizedGainLossAmount: bigint('realized_gain_loss_amount', {
      mode: 'number',
    }).notNull(),
    realizedGainLossCurrency: varchar('realized_gain_loss_currency', {
      length: 3,
    }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.costBasisConsumedCurrency],
      foreignColumns: [currenciesInCore.code],
      name: 'subledger_fx_cost_basis_lot__cost_basis_consumed_currency_fkey1',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.realizedGainLossCurrency],
      foreignColumns: [currenciesInCore.code],
      name: 'subledger_fx_cost_basis_lot_d_realized_gain_loss_currency_fkey1',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.proceedsCurrency],
      foreignColumns: [currenciesInCore.code],
      name: 'subledger_fx_cost_basis_lot_disposition__proceeds_currency_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.quantityCurrency],
      foreignColumns: [currenciesInCore.code],
      name: 'subledger_fx_cost_basis_lot_disposition__quantity_currency_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.dispositionId],
      foreignColumns: [subledgerFxCostBasisLotDispositionsInCore.id],
      name: 'subledger_fx_cost_basis_lot_disposition_all_disposition_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [actorsInCore.id],
      name: 'subledger_fx_cost_basis_lot_disposition_allocat_created_by_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.lotId],
      foreignColumns: [subledgerFxCostBasisLotsInCore.id],
      name: 'subledger_fx_cost_basis_lot_disposition_allocations_lot_id_fkey',
    }).onDelete('cascade'),
  ]
);

export const outboxInCore = core.table(
  'outbox',
  {
    id: uuid().primaryKey().notNull(),
    correlationId: varchar('correlation_id', { length: 255 }).notNull(),
    type: varchar({ length: 255 }).notNull(),
    data: jsonb(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('outbox_type_created_at_id_idx').using(
      'btree',
      table.type.asc().nullsLast().op('text_ops'),
      table.createdAt.asc().nullsLast().op('text_ops'),
      table.id.asc().nullsLast().op('text_ops')
    ),
  ]
);

export const jurisdictionAccountingStandardsInCore = core.table(
  'jurisdiction_accounting_standards',
  {
    jurisdictionCode: varchar('jurisdiction_code', { length: 2 }).notNull(),
    accountingStandardCode: varchar('accounting_standard_code', {
      length: 15,
    }).notNull(),
    accountingEntityType: accountingEntityTypeInCore(
      'accounting_entity_type'
    ).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.accountingStandardCode],
      foreignColumns: [accountingStandardsInCore.code],
      name: 'jurisdiction_accounting_standards_accounting_standard_code_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.jurisdictionCode],
      foreignColumns: [jurisdictionsInCore.code],
      name: 'jurisdiction_accounting_standards_jurisdiction_code_fkey',
    }).onDelete('cascade'),
    primaryKey({
      columns: [
        table.jurisdictionCode,
        table.accountingStandardCode,
        table.accountingEntityType,
      ],
      name: 'jurisdiction_accounting_standards_pkey',
    }),
  ]
);

export const bankDetailsInCore = core.table(
  'bank_details',
  {
    createdBy: uuid('created_by').notNull(),
    bankName: varchar('bank_name', { length: 100 }).notNull(),
    accountNumber: varchar('account_number', { length: 34 }).notNull(),
    accountName: varchar('account_name', { length: 100 }).notNull(),
    countryCode: varchar('country_code', { length: 2 }).notNull(),
    accountingEntityId: uuid('accounting_entity_id').notNull(),
    ledgerAccountId: uuid('ledger_account_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.accountingEntityId],
      foreignColumns: [accountingEntitiesInCore.id],
      name: 'bank_details_accounting_entity_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [actorsInCore.id],
      name: 'bank_details_created_by_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.ledgerAccountId],
      foreignColumns: [ledgerAccountsInCore.id],
      name: 'bank_details_ledger_account_id_fkey',
    }).onDelete('cascade'),
    primaryKey({
      columns: [table.bankName, table.accountNumber],
      name: 'bank_accounts_pkey',
    }),
    unique('bank_accounts_ledger_account_id_uk').on(table.ledgerAccountId),
  ]
);
