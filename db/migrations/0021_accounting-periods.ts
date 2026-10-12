import { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

import {
  accountingPeriodsTable,
  fiscalYearsTable,
  periodStatus,
  periodUnit,
} from '../config/accounting';
import { accountingEntitiesTable } from '../config/accounting-entity';
import { actorsTable } from '../config/actors';
import toSchemaString from '../utils/to-schema-string';

export const shorthands: ColumnDefinitions | undefined = undefined;

export function up(pgm: MigrationBuilder) {
  pgm.createExtension('btree_gist', { ifNotExists: true });

  pgm.createTable(accountingPeriodsTable, {
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

    accounting_entity_id: {
      type: 'uuid',
      notNull: true,
      references: accountingEntitiesTable,
      onDelete: 'CASCADE',
    },

    fiscal_year_id: {
      type: 'uuid',
      notNull: true,
      references: fiscalYearsTable,
      onDelete: 'CASCADE',
    },

    unit: {
      type: toSchemaString(periodUnit),
      notNull: true,
    },

    count: {
      type: 'smallint',
      notNull: true,
    },

    start_date: {
      type: 'date',
      notNull: true,
    },

    end_date: {
      type: 'date',
      notNull: true,
    },

    status: {
      type: toSchemaString(periodStatus),
      notNull: true,
    },

    closed_at: {
      type: 'timestamptz',
    },

    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });
  pgm.addConstraint(
    accountingPeriodsTable,
    'accounting_periods_dates_ordered',
    {
      check: 'start_date <= end_date',
    }
  );
  pgm.sql(`ALTER TABLE ${toSchemaString(accountingPeriodsTable)}
    ADD CONSTRAINT accounting_periods_entity_dates_excl
    EXCLUDE USING gist (
      accounting_entity_id WITH =,
      daterange(start_date, end_date, '[]') WITH &&
    )`);
}

export function down(pgm: MigrationBuilder) {
  pgm.dropTable(accountingPeriodsTable);
}
