import { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

import {
  accountingIntervalsTable,
  accountingIntervalUnit,
  fiscalYearsTable,
} from '../config/accounting';
import { accountingEntitiesTable } from '../config/accounting-entity';
import { actorsTable } from '../config/actors';
import toSchemaString from '../utils/to-schema-string';

export const shorthands: ColumnDefinitions | undefined = undefined;

export function up(pgm: MigrationBuilder) {
  pgm.createType(accountingIntervalUnit, [
    'day',
    'week',
    'month',
    'quarter',
    'year',
  ]);

  pgm.createTable(accountingIntervalsTable, {
    id: {
      type: 'uuid',
      primaryKey: true,
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
      type: toSchemaString(accountingIntervalUnit),
      notNull: true,
    },
    count: {
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
    current_period_ordinal: {
      type: 'integer',
      notNull: true,
    },
    next_period_start_date: {
      type: 'timestamptz',
    },
    created_by: {
      type: 'uuid',
      notNull: true,
      references: actorsTable,
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
  });

  pgm.addConstraint(
    accountingIntervalsTable,
    'accounting_intervals_dates_ordered',
    {
      check: 'start_date < end_date',
    }
  );
  pgm.addConstraint(
    accountingIntervalsTable,
    'accounting_intervals_count_positive',
    {
      check: 'count > 0',
    }
  );
  pgm.addConstraint(
    accountingIntervalsTable,
    'accounting_intervals_current_period_valid',
    {
      check: 'current_period_ordinal >= 0 AND current_period_ordinal < count',
    }
  );
  pgm.addConstraint(
    accountingIntervalsTable,
    'accounting_intervals_next_start_valid',
    {
      check: `(
      (current_period_ordinal = count - 1 AND next_period_start_date IS NULL)
      OR (
        current_period_ordinal < count - 1
        AND next_period_start_date IS NOT NULL
        AND next_period_start_date > start_date
        AND next_period_start_date < end_date
      )
    )`,
    }
  );

  pgm.createIndex(accountingIntervalsTable, 'accounting_entity_id');
  pgm.createIndex(accountingIntervalsTable, 'fiscal_year_id');
  pgm.createIndex(accountingIntervalsTable, 'next_period_start_date', {
    name: 'accounting_intervals_next_start_idx',
    where: 'next_period_start_date IS NOT NULL',
  });
}

export function down(pgm: MigrationBuilder) {
  pgm.dropTable(accountingIntervalsTable);
  pgm.dropType(accountingIntervalUnit);
}
