import type { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

import { actorsTable } from '../config/actors';
import { currenciesTable } from '../config/currencies';
import {
  subledgerFxCostBasisLotDispositionAllocationsTable,
  subledgerFxCostBasisLotDispositionsTable,
  subledgerFxCostBasisLotsTable,
} from '../config/fx-cost-basis-lots';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(
    subledgerFxCostBasisLotDispositionAllocationsTable,
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

      disposition_id: {
        type: 'uuid',
        notNull: true,
        references: subledgerFxCostBasisLotDispositionsTable,
        onDelete: 'CASCADE',
      },

      lot_id: {
        type: 'uuid',
        notNull: true,
        references: subledgerFxCostBasisLotsTable,
        onDelete: 'CASCADE',
      },

      quantity_amount: {
        type: 'bigint',
        notNull: true,
      },

      quantity_currency: {
        type: 'varchar(3)',
        notNull: true,
        references: currenciesTable,
        onDelete: 'RESTRICT',
      },

      cost_basis_consumed_amount: {
        type: 'bigint',
        notNull: true,
      },

      cost_basis_consumed_currency: {
        type: 'varchar(3)',
        notNull: true,
        references: currenciesTable,
        onDelete: 'RESTRICT',
      },

      proceeds_amount: {
        type: 'bigint',
        notNull: true,
      },

      proceeds_currency: {
        type: 'varchar(3)',
        notNull: true,
        references: currenciesTable,
        onDelete: 'RESTRICT',
      },

      realized_gain_loss_amount: {
        type: 'bigint',
        notNull: true,
      },

      realized_gain_loss_currency: {
        type: 'varchar(3)',
        notNull: true,
        references: currenciesTable,
        onDelete: 'RESTRICT',
      },

      created_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('now()'),
      },
    },
    {
      ifNotExists: true,
    }
  );
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(subledgerFxCostBasisLotDispositionAllocationsTable);
}
