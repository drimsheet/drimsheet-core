import { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

import {
  accountingContextsTable,
  reportingContextsTable,
  reportingIntervalsTable,
} from '../config/accounting';
import { accountingEntitiesTable } from '../config/accounting-entity';
import { actorsTable } from '../config/actors';
import { currenciesTable } from '../config/currencies';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(reportingContextsTable, {
    created_by: {
      type: 'uuid',
      notNull: true,
      references: actorsTable,
      onDelete: 'RESTRICT',
    },
    id: {
      type: 'uuid',
      default: pgm.func('uuid_generate_v4()'),
      primaryKey: true,
    },

    name: {
      type: 'varchar(150)',
      notNull: true,
    },

    description: {
      type: 'varchar(255)',
    },

    accounting_entity_id: {
      type: 'uuid',
      notNull: true,
      references: accountingEntitiesTable,
      onDelete: 'CASCADE',
    },

    reporting_currency_code: {
      type: 'varchar(3)',
      notNull: true,
      references: currenciesTable,
      onDelete: 'RESTRICT',
    },

    accounting_context_id: {
      type: 'uuid',
      notNull: true,
      references: accountingContextsTable,
      // ACC-RC-006 includes closed contexts.
      unique: true,
      onDelete: 'RESTRICT',
    },

    reporting_interval_id: {
      type: 'uuid',
      notNull: true,
      references: reportingIntervalsTable,
      onDelete: 'RESTRICT',
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

    closed_at: {
      type: 'timestamptz',
    },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(reportingContextsTable);
}
