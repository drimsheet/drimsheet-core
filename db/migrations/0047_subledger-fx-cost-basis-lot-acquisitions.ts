import { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

import { accountingEntitiesTable } from '../config/accounting-entity';
import { actorsTable } from '../config/actors';
import { currenciesTable } from '../config/currencies';
import {
  subledgerFxCostBasisLotAcquisitionsTable,
  subledgerFxCostBasisLotsTable,
} from '../config/fx-cost-basis-lots';
import { journalEntriesTable } from '../config/journal-entries';
import { ledgerAccountsTable } from '../config/ledger-accounts';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(
    subledgerFxCostBasisLotAcquisitionsTable,
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

      lot_id: {
        type: 'uuid',
        notNull: true,
        references: subledgerFxCostBasisLotsTable,
        onDelete: 'CASCADE',
      },

      journal_entry_id: {
        type: 'uuid',
        notNull: true,
        references: journalEntriesTable,
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

      acquisition_rate: {
        type: 'jsonb',
        notNull: true,
      },

      acquisition_date: {
        type: 'date',
        notNull: true,
      },

      official_rate: {
        type: 'jsonb',
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
  pgm.dropTable(subledgerFxCostBasisLotAcquisitionsTable);
}
