import { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

import { accountingEntitiesTable } from '../config/accounting-entity';
import { actorsTable } from '../config/actors';
import { currenciesTable } from '../config/currencies';
import { ledgerAccountBalancesTable } from '../config/ledger-account-balances';
import { ledgerAccountsTable } from '../config/ledger-accounts';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(ledgerAccountBalancesTable, {
    created_by: {
      type: 'uuid',
      notNull: true,
      references: actorsTable,
      onDelete: 'RESTRICT',
    },
    ledger_account_id: {
      type: 'uuid',
      onDelete: 'CASCADE',
      primaryKey: true,
      references: ledgerAccountsTable,
    },

    accounting_entity_id: {
      type: 'uuid',
      onDelete: 'CASCADE',
      notNull: true,
      references: accountingEntitiesTable,
    },

    account_materialized_path: {
      type: 'varchar(100)',
      notNull: true,
    },

    amount: {
      type: 'bigint',
      notNull: true,
      default: 0,
    },

    currency_code: {
      type: 'varchar(3)',
      notNull: true,
      references: currenciesTable,
      onDelete: 'RESTRICT',
    },

    functional_amount: {
      type: 'bigint',
      notNull: true,
      default: 0,
    },

    functional_currency_code: {
      type: 'varchar(3)',
      notNull: true,
      references: currenciesTable,
      onDelete: 'RESTRICT',
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
  });

  pgm.addConstraint(
    ledgerAccountBalancesTable,
    'ledger_account_balances_path_entity_id_uk',
    {
      unique: ['account_materialized_path', 'accounting_entity_id'],
    }
  );
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(ledgerAccountBalancesTable);
}
