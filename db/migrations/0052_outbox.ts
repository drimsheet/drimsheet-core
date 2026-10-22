import type { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

import { outboxTable } from '../config/outbox';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(outboxTable, {
    id: {
      type: 'uuid',
      primaryKey: true,
    },
    correlation_id: {
      type: 'varchar(255)',
      notNull: true,
    },
    type: {
      type: 'varchar(255)',
      notNull: true,
    },
    data: {
      type: 'jsonb',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createIndex(outboxTable, ['type', 'created_at', 'id'], {
    name: 'outbox_type_created_at_id_idx',
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(outboxTable);
}
