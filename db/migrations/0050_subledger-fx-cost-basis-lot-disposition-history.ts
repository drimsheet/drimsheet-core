import type { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

import { actorsTable } from '../config/actors';
import { subledgerFxCostBasisLotDispositionHistoryTable } from '../config/fx-cost-basis-lots';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(subledgerFxCostBasisLotDispositionHistoryTable, {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },
    disposition_id: {
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
    subledgerFxCostBasisLotDispositionHistoryTable,
    'subledger_fx_cost_basis_lot_disposition_history_diff_check',
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

  pgm.createIndex(subledgerFxCostBasisLotDispositionHistoryTable, 'actor_id');
  pgm.createIndex(
    subledgerFxCostBasisLotDispositionHistoryTable,
    'on_behalf_of'
  );

  pgm.createIndex(
    subledgerFxCostBasisLotDispositionHistoryTable,
    [
      'disposition_id',
      { name: 'occurred_at', sort: 'DESC' },
      { name: 'id', sort: 'DESC' },
    ],
    {
      name: 'subledger_fx_cost_basis_lot_disposition_history_timeline_idx',
    }
  );

  pgm.createIndex(
    subledgerFxCostBasisLotDispositionHistoryTable,
    [
      'accounting_entity_id',
      { name: 'occurred_at', sort: 'DESC' },
      { name: 'id', sort: 'DESC' },
    ],
    {
      name: 'subledger_fx_cost_basis_lot_disposition_history_tenant_timeline_idx',
    }
  );
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(subledgerFxCostBasisLotDispositionHistoryTable);
}
