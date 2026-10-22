import { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

import { reportingPeriodHistoryTable } from '../config/accounting';
import { actorsTable } from '../config/actors';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(reportingPeriodHistoryTable, {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },
    reporting_period_id: {
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
    reportingPeriodHistoryTable,
    'reporting_period_history_diff_check',
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

  pgm.createIndex(reportingPeriodHistoryTable, 'actor_id');
  pgm.createIndex(reportingPeriodHistoryTable, 'on_behalf_of');

  pgm.createIndex(
    reportingPeriodHistoryTable,
    [
      'reporting_period_id',
      { name: 'occurred_at', sort: 'DESC' },
      { name: 'id', sort: 'DESC' },
    ],
    {
      name: 'reporting_period_history_timeline_idx',
    }
  );
  pgm.createIndex(
    reportingPeriodHistoryTable,
    [
      'accounting_entity_id',
      { name: 'occurred_at', sort: 'DESC' },
      { name: 'id', sort: 'DESC' },
    ],
    {
      name: 'reporting_period_history_tenant_timeline_idx',
    }
  );
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(reportingPeriodHistoryTable);
}
