import { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

import { accountingEntitiesTable } from '../config/accounting-entity';
import { actorsTable } from '../config/actors';
import {
  journalEntriesTable,
  journalEntrySourceType,
  journalEntryStatus,
} from '../config/journal-entries';
import toSchemaString from '../utils/to-schema-string';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createType(journalEntryStatus, ['draft', 'posted', 'voided', 'archived']);
  pgm.createType(journalEntrySourceType, [
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
  ]);

  pgm.createTable(journalEntriesTable, {
    created_by: {
      type: 'uuid',
      notNull: true,
      references: actorsTable,
      onDelete: 'RESTRICT',
    },
    id: {
      type: 'uuid',
      primaryKey: true,
      notNull: true,
    },

    accounting_entity_id: {
      type: 'uuid',
      references: accountingEntitiesTable,
      notNull: true,
      onDelete: 'CASCADE',
    },

    source_type: {
      type: toSchemaString(journalEntrySourceType),
      notNull: true,
    },

    memo: {
      type: 'varchar(100)',
    },

    status: {
      type: toSchemaString(journalEntryStatus),
      notNull: true,
    },

    effective_date: {
      type: 'date',
      notNull: true,
    },

    posted_at: {
      type: 'timestamptz',
    },

    voided_at: {
      type: 'timestamptz',
    },

    voiding_entry_id: {
      type: 'uuid',
      references: journalEntriesTable,
      unique: true,
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
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(journalEntriesTable);

  pgm.dropType(journalEntryStatus);
  pgm.dropType(journalEntrySourceType);
}
