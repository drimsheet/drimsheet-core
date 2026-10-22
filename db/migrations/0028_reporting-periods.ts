import { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

import {
  reportingIntervalsTable,
  reportingPeriodsTable,
} from '../config/accounting';
import { accountingEntitiesTable } from '../config/accounting-entity';
import { actorsTable } from '../config/actors';

export const shorthands: ColumnDefinitions | undefined = undefined;

export function up(pgm: MigrationBuilder) {
  pgm.createTable(reportingPeriodsTable, {
    created_by: {
      type: 'uuid',
      notNull: true,
      references: actorsTable,
      onDelete: 'RESTRICT',
    },
    id: {
      type: 'uuid',
      primaryKey: true,
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
      references: reportingIntervalsTable,
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
  pgm.addConstraint(reportingPeriodsTable, 'reporting_periods_dates_ordered', {
    check: 'start_date < end_date',
  });
  pgm.addConstraint(
    reportingPeriodsTable,
    'reporting_periods_ordinal_nonnegative',
    {
      check: 'ordinal >= 0',
    }
  );
  pgm.addConstraint(
    reportingPeriodsTable,
    'reporting_periods_interval_ordinal_key',
    {
      unique: ['interval_id', 'ordinal'],
    }
  );
  pgm.addConstraint(
    reportingPeriodsTable,
    'reporting_periods_interval_start_date_key',
    {
      unique: ['interval_id', 'start_date'],
    }
  );

  pgm.createIndex(reportingPeriodsTable, 'accounting_entity_id');
}

export function down(pgm: MigrationBuilder) {
  pgm.dropTable(reportingPeriodsTable);
}
