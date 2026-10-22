import { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

import { accountingEntitiesTable } from '../config/accounting-entity';
import { actorsTable } from '../config/actors';
import { currenciesTable } from '../config/currencies';
import {
  subledgerFxCostBasisLotsTable,
  subledgerFxCostBasisLotStatus,
} from '../config/fx-cost-basis-lots';
import { ledgerAccountsTable } from '../config/ledger-accounts';
import toSchemaString from '../utils/to-schema-string';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createType(subledgerFxCostBasisLotStatus, ['open', 'closed']);

  pgm.createTable(
    subledgerFxCostBasisLotsTable,
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

      ledger_account_id: {
        type: 'uuid',
        notNull: true,
        references: ledgerAccountsTable,
        onDelete: 'CASCADE',
      },

      accounting_entity_id: {
        type: 'uuid',
        notNull: true,
        references: accountingEntitiesTable,
        onDelete: 'CASCADE',
      },

      status: {
        type: toSchemaString(subledgerFxCostBasisLotStatus),
        notNull: true,
      },

      original_quantity_amount: {
        type: 'bigint',
        notNull: true,
      },

      original_quantity_currency: {
        type: 'varchar(3)',
        notNull: true,
        references: currenciesTable,
        onDelete: 'RESTRICT',
      },

      remaining_quantity_amount: {
        type: 'bigint',
        notNull: true,
      },

      cost_basis_amount: {
        type: 'bigint',
        notNull: true,
      },

      cost_basis_currency: {
        type: 'varchar(3)',
        notNull: true,
        references: currenciesTable,
        onDelete: 'RESTRICT',
      },

      remaining_cost_basis_amount: {
        type: 'bigint',
        notNull: true,
      },

      acquisition_rate: {
        type: 'jsonb',
        notNull: true,
      },

      acquisition_date: {
        type: 'timestamptz',
        notNull: true,
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
    },
    {
      ifNotExists: true,
    }
  );

  pgm.createIndex(
    subledgerFxCostBasisLotsTable,
    [
      'accounting_entity_id',
      'ledger_account_id',
      'status',
      'acquisition_date',
      'created_at',
      'id',
    ],
    { name: 'subledger_fx_cost_basis_lots_fifo_idx' }
  );
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(subledgerFxCostBasisLotsTable);
  pgm.dropType(subledgerFxCostBasisLotStatus);
}
