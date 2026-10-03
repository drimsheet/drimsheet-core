import { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

import { accountingEntitiesTable } from '../config/accounting-entity';
import { actorsTable } from '../config/actors';
import { currenciesTable } from '../config/currencies';
import {
  adjunctAccountRule,
  contraAccountRule,
  ledgerAccountsTable,
  ledgerAccountStatus,
  ledgerType,
  normalBalanceType,
} from '../config/ledger-accounts';
import toSchemaString from '../utils/to-schema-string';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createType(ledgerType, [
    'asset',
    'liability',
    'equity',
    'revenue',
    'expense',
  ]);
  pgm.createType(normalBalanceType, ['debit', 'credit']);
  pgm.createType(ledgerAccountStatus, ['active', 'archived', 'draft']);
  pgm.createType(contraAccountRule, [
    'contra_permitted',
    'contra_not_permitted',
    'contra_only',
    'contra_not_applicable',
  ]);
  pgm.createType(adjunctAccountRule, [
    'adjunct_permitted',
    'adjunct_not_permitted',
    'adjunct_only',
    'adjunct_not_applicable',
  ]);

  pgm.createTable(
    ledgerAccountsTable,
    {
      created_by: {
        type: 'uuid',
        notNull: true,
        references: actorsTable,
        onDelete: 'RESTRICT',
      },
      id: {
        type: 'uuid',
        primaryKey: true,
        default: pgm.func('uuid_generate_v4()'),
      },
      code: {
        type: 'varchar(6)',
        notNull: true,
      },
      materialized_path: {
        type: 'varchar(100)',
        notNull: true,
      },
      accounting_entity_id: {
        type: 'uuid',
        notNull: true,
        references: accountingEntitiesTable,
        onDelete: 'CASCADE',
      },
      type: {
        type: toSchemaString(ledgerType),
        notNull: true,
      },
      normal_balance: {
        type: toSchemaString(normalBalanceType),
        notNull: true,
      },
      sub_type: {
        type: 'varchar',
        notNull: true,
      },
      behavior: {
        type: 'varchar',
        notNull: true,
      },
      is_control_account: {
        type: 'boolean',
        notNull: true,
        default: false,
      },
      control_account_id: {
        type: 'uuid',
        references: ledgerAccountsTable,
        onDelete: 'RESTRICT',
      },
      name: {
        type: 'varchar(100)',
        notNull: true,
      },
      currency_code: {
        type: 'varchar(3)',
        references: currenciesTable,
        notNull: false,
        onDelete: 'RESTRICT',
      },
      status: {
        type: toSchemaString(ledgerAccountStatus),
        notNull: true,
      },
      contra_account_rule: {
        type: toSchemaString(contraAccountRule),
        notNull: true,
      },
      adjunct_account_rule: {
        type: toSchemaString(adjunctAccountRule),
        notNull: true,
      },
      opening_balance_date: {
        type: 'date',
      },
      meta: {
        type: 'jsonb',
      },
      version: {
        type: 'integer',
        notNull: true,
      },

      created_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('now()'),
      },
      updated_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('now()'),
      },
      deleted_at: { type: 'timestamptz' },
    },
    {
      ifNotExists: true,
    }
  );

  pgm.addConstraint(
    ledgerAccountsTable,
    'ledger_accounts_code_accounting_entity_id_uk',
    {
      unique: ['code', 'accounting_entity_id'],
    }
  );

  pgm.addConstraint(
    ledgerAccountsTable,
    'ledger_accounts_path_accounting_entity_id_uk',
    {
      unique: ['materialized_path', 'accounting_entity_id'],
    }
  );

  pgm.addConstraint(
    ledgerAccountsTable,
    'ledger_accounts_version_positive_ck',
    {
      check: 'version > 0',
    }
  );

  const suspensePredicate =
    "sub_type = 'suspense' AND type IN ('asset', 'liability')";

  pgm.addConstraint(
    ledgerAccountsTable,
    'ledger_accounts_suspense_currency_required_ck',
    {
      check: `NOT (${suspensePredicate}) OR currency_code IS NOT NULL`,
    }
  );

  pgm.createIndex(
    ledgerAccountsTable,
    ['accounting_entity_id', 'type', 'currency_code'],
    {
      name: 'ledger_accounts_suspense_entity_type_currency_uk',
      unique: true,
      where: suspensePredicate,
    }
  );
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(ledgerAccountsTable);
  pgm.dropType(adjunctAccountRule);
  pgm.dropType(contraAccountRule);
  pgm.dropType(ledgerAccountStatus);
  pgm.dropType(normalBalanceType);
  pgm.dropType(ledgerType);
}
