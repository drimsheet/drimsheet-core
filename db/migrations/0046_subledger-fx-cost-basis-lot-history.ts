import { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

import { actorsTable } from '../config/actors';
import { subledgerFxCostBasisLotHistoryTable } from '../config/fx-cost-basis-lots';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(subledgerFxCostBasisLotHistoryTable, {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },
    lot_id: {
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
    subledgerFxCostBasisLotHistoryTable,
    'subledger_fx_cost_basis_lot_history_diff_check',
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

  pgm.createIndex(subledgerFxCostBasisLotHistoryTable, 'actor_id');
  pgm.createIndex(subledgerFxCostBasisLotHistoryTable, 'on_behalf_of');

  pgm.createIndex(
    subledgerFxCostBasisLotHistoryTable,
    [
      'lot_id',
      { name: 'occurred_at', sort: 'DESC' },
      { name: 'id', sort: 'DESC' },
    ],
    {
      name: 'subledger_fx_cost_basis_lot_history_timeline_idx',
    }
  );

  pgm.createIndex(
    subledgerFxCostBasisLotHistoryTable,
    [
      'accounting_entity_id',
      { name: 'occurred_at', sort: 'DESC' },
      { name: 'id', sort: 'DESC' },
    ],
    {
      name: 'subledger_fx_cost_basis_lot_history_tenant_timeline_idx',
    }
  );
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(subledgerFxCostBasisLotHistoryTable);
}
