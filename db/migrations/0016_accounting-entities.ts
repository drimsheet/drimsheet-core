import { MigrationBuilder } from 'node-pg-migrate';

import { jurisdictionsTable } from '../config/accounting';
import {
  accountingEntitiesTable,
  accountingEntityStatus,
  accountingEntityType,
} from '../config/accounting-entity';
import { actorsTable } from '../config/actors';
import { currenciesTable } from '../config/currencies';
import { usersTable } from '../config/users';
import toSchemaString from '../utils/to-schema-string';

export const up = (pgm: MigrationBuilder) => {
  pgm.createType(accountingEntityStatus, ['active', 'archived']);

  pgm.createTable(
    accountingEntitiesTable,
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

      type: {
        type: toSchemaString(accountingEntityType),
        notNull: true,
      },

      status: {
        type: toSchemaString(accountingEntityStatus),
        notNull: true,
        default: 'active',
      },

      name: {
        type: 'varchar(255)',
        notNull: true,
      },

      owner_id: {
        type: 'uuid',
        references: usersTable,
        notNull: true,
        onDelete: 'CASCADE',
      },

      functional_currency_code: {
        type: 'varchar(3)',
        notNull: true,
        references: toSchemaString(currenciesTable),
      },

      jurisdiction_code: {
        type: 'varchar(2)',
        notNull: true,
        references: toSchemaString(jurisdictionsTable),
      },

      created_at: {
        type: 'timestamptz',
        default: pgm.func('now()'),
        notNull: true,
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

  pgm.createIndex(accountingEntitiesTable, ['owner_id'], {
    name: 'accounting_entities_unique_individual_owner_idx',
    unique: true,
    where: "type = 'individual'",
  });
  pgm.createIndex(accountingEntitiesTable, 'created_by');
};

export const down = (pgm: MigrationBuilder) => {
  pgm.dropTable(accountingEntitiesTable);
  pgm.dropType(accountingEntityStatus);
};
