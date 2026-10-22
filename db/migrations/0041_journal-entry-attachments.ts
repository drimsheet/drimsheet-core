import { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

import {
  journalEntriesTable,
  journalEntryAttachmentsTable,
} from '../config/journal-entries';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(journalEntryAttachmentsTable, {
    journal_entry_id: {
      type: 'uuid',
      primaryKey: true,
      references: journalEntriesTable,
      onDelete: 'CASCADE',
    },
    data: {
      type: 'jsonb',
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
  pgm.dropTable(journalEntryAttachmentsTable);
}
