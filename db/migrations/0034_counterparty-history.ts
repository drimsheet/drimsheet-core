import { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

import { actorsTable } from '../config/actors';
import { counterpartyHistoryTable } from '../config/counterparties';

export const shorthands: ColumnDefinitions | undefined = undefined;

export function up(pgm: MigrationBuilder) {
  pgm.createTable(counterpartyHistoryTable, {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },
    counterparty_id: {
      type: 'uuid',
      notNull: true,
    },
    accounting_entity_id: {
      type: 'uuid',
      notNull: true,
    },
    actor_id: {
      type: 'uuid',
      notNull: true,
      references: actorsTable,
      onDelete: 'RESTRICT',
    },
    on_behalf_of: {
      type: 'uuid',
      references: actorsTable,
      onDelete: 'RESTRICT',
    },
    entity_version: { type: 'integer', notNull: true },

    action: {
      type: 'varchar(50)',
      notNull: true,
    },
    diff: {
      type: 'jsonb',
      notNull: true,
    },
    correlation_id: {
      type: 'varchar(255)',
    },
    occurred_at: {
      type: 'timestamptz',
      notNull: true,
    },
    recorded_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.addConstraint(
    counterpartyHistoryTable,
    'counterparty_history_diff_check',
    {
      check: `(
        jsonb_typeof(diff) = 'object'
        AND diff ? 'before'
        AND diff ? 'after'
        AND (
          diff->'before' <> 'null'::jsonb
          OR diff->'after' <> 'null'::jsonb
        )
      )`,
    }
  );

  pgm.createIndex(counterpartyHistoryTable, 'actor_id');
  pgm.createIndex(counterpartyHistoryTable, 'on_behalf_of');

  pgm.createIndex(
    counterpartyHistoryTable,
    [
      'counterparty_id',
      { name: 'occurred_at', sort: 'DESC' },
      { name: 'id', sort: 'DESC' },
    ],
    {
      name: 'counterparty_history_timeline_idx',
    }
  );

  pgm.createIndex(
    counterpartyHistoryTable,
    [
      'accounting_entity_id',
      { name: 'occurred_at', sort: 'DESC' },
      { name: 'id', sort: 'DESC' },
    ],
    {
      name: 'counterparty_history_tenant_timeline_idx',
    }
  );
}

export function down(pgm: MigrationBuilder) {
  pgm.dropTable(counterpartyHistoryTable);
}
