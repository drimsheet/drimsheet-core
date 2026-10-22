import { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

import {
  accountingIntervalsTable,
  accountingPeriodsTable,
  accountingPeriodStatus,
} from '../config/accounting';
import { accountingEntitiesTable } from '../config/accounting-entity';
import { actorsTable } from '../config/actors';
import toSchemaString from '../utils/to-schema-string';

export const shorthands: ColumnDefinitions | undefined = undefined;

export function up(pgm: MigrationBuilder) {
  pgm.createExtension('btree_gist', { ifNotExists: true });

  pgm.createType(accountingPeriodStatus, ['open', 'closed']);

  pgm.createTable(accountingPeriodsTable, {
    id: {
      type: 'uuid',
      primaryKey: true,
    },

    created_by: {
      type: 'uuid',
      notNull: true,
      references: actorsTable,
      onDelete: 'RESTRICT',
    },

    name: {
      type: 'varchar(100)',
      notNull: true,
    },

    accounting_entity_id: {
      type: 'uuid',
      notNull: true,
      references: accountingEntitiesTable,
      onDelete: 'CASCADE',
    },

    interval_id: {
      type: 'uuid',
      notNull: true,
      references: accountingIntervalsTable,
      onDelete: 'CASCADE',
    },

    ordinal: {
      type: 'integer',
      notNull: true,
    },

    start_date: {
      type: 'timestamptz',
      notNull: true,
    },

    end_date: {
      type: 'timestamptz',
      notNull: true,
    },

    status: {
      type: toSchemaString(accountingPeriodStatus),
      notNull: true,
    },

    closed_at: {
      type: 'timestamptz',
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
  });

  pgm.addConstraint(
    accountingPeriodsTable,
    'accounting_periods_dates_ordered',
    {
      check: 'start_date < end_date',
    }
  );
  pgm.addConstraint(
    accountingPeriodsTable,
    'accounting_periods_ordinal_nonnegative',
    {
      check: 'ordinal >= 0',
    }
  );
  pgm.addConstraint(
    accountingPeriodsTable,
    'accounting_periods_interval_ordinal_key',
    {
      unique: ['interval_id', 'ordinal'],
    }
  );
  pgm.addConstraint(
    accountingPeriodsTable,
    'accounting_periods_interval_start_date_key',
    {
      unique: ['interval_id', 'start_date'],
    }
  );

  pgm.sql(`ALTER TABLE ${toSchemaString(accountingPeriodsTable)}
    ADD CONSTRAINT accounting_periods_entity_dates_excl
    EXCLUDE USING gist (
      accounting_entity_id WITH =,
      tstzrange(start_date, end_date, '[)') WITH &&
    )`);

  pgm.createIndex(accountingPeriodsTable, 'accounting_entity_id');
}

export function down(pgm: MigrationBuilder) {
  pgm.dropTable(accountingPeriodsTable);
  pgm.dropType(accountingPeriodStatus);
}
