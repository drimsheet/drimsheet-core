import { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

import { actorsTable } from '../config/actors';
import { counterpartiesTable } from '../config/counterparties';
import { currenciesTable } from '../config/currencies';
import {
  journalEntriesTable,
  journalLinesTable,
  journalSide,
} from '../config/journal-entries';
import { ledgerAccountsTable } from '../config/ledger-accounts';
import toSchemaString from '../utils/to-schema-string';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createType(journalSide, ['debit', 'credit']);

  pgm.createTable(journalLinesTable, {
    created_by: {
      type: 'uuid',
      notNull: true,
      references: actorsTable,
      onDelete: 'RESTRICT',
    },
    id: {
      type: 'uuid',
      primaryKey: true,
    },

    entry_id: {
      type: 'uuid',
      notNull: true,
      references: journalEntriesTable,
      onDelete: 'CASCADE',
    },

    account_id: {
      type: 'uuid',
      notNull: true,
      references: ledgerAccountsTable,
      onDelete: 'CASCADE',
    },

    counterparty_id: {
      type: 'uuid',
      references: counterpartiesTable,
      notNull: false,
    },

    sequence_order: {
      type: 'integer',
      notNull: true,
    },

    amount: {
      type: 'bigint',
      notNull: true,
    },

    currency_code: {
      type: 'varchar(3)',
      notNull: true,
      references: currenciesTable,
      onDelete: 'RESTRICT',
    },

    exchange_rate: {
      type: 'jsonb',
    },

    functional_amount: {
      type: 'bigint',
      notNull: true,
    },

    functional_currency_code: {
      type: 'varchar(3)',
      notNull: true,
      references: currenciesTable,
      onDelete: 'RESTRICT',
    },

    side: {
      type: toSchemaString(journalSide),
      notNull: true,
    },

    description: {
      type: 'varchar(100)',
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
  });

  pgm.createIndex(journalLinesTable, ['counterparty_id', 'entry_id'], {
    name: 'journal_lines_counterparty_entry_idx',
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(journalLinesTable);
  pgm.dropType(journalSide);
}
