import { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

import { accountingEntitiesTable } from '../config/accounting-entity';
import { actorsTable } from '../config/actors';
import {
  counterpartiesTable,
  counterpartyStatus,
  counterpartyType,
} from '../config/counterparties';
import toSchemaString from '../utils/to-schema-string';

export const shorthands: ColumnDefinitions | undefined = undefined;

export function up(pgm: MigrationBuilder) {
  pgm.createType(counterpartyStatus, ['active', 'archived', 'draft']);
  pgm.createType(counterpartyType, ['individual', 'organization']);

  pgm.createTable(counterpartiesTable, {
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

    accounting_entity_id: {
      type: 'uuid',
      references: accountingEntitiesTable,
      notNull: true,
    },

    name: {
      type: 'varchar(255)',
      notNull: true,
    },

    status: {
      type: toSchemaString(counterpartyStatus),
      notNull: true,
    },

    type: {
      type: toSchemaString(counterpartyType),
      notNull: true,
    },

    meta: {
      type: 'jsonb',
      notNull: true,
      default: pgm.func("'{}'::jsonb"),
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

  pgm.addConstraint(counterpartiesTable, 'counterparties_meta_check', {
    check: `jsonb_typeof(meta) = 'object'
      AND meta - ARRAY['employer', 'vendor', 'contractor']::text[] = '{}'::jsonb`,
  });

  for (const role of ['employer', 'vendor', 'contractor']) {
    pgm.addConstraint(
      counterpartiesTable,
      `counterparties_${role}_meta_check`,
      {
        check: `NOT (meta ? '${role}') OR COALESCE(jsonb_typeof(meta->'${role}') = 'object', false)`,
      }
    );
  }

  pgm.createIndex(counterpartiesTable, ['accounting_entity_id'], {
    name: 'counterparties_accounting_entity_id_idx',
  });
}

export function down(pgm: MigrationBuilder) {
  pgm.dropTable(counterpartiesTable);
  pgm.dropType(counterpartyType);
  pgm.dropType(counterpartyStatus);
}
