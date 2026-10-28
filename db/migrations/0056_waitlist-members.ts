import { MigrationBuilder } from 'node-pg-migrate';

import { waitListMembersTable } from '../config/users';

export const up = (pgm: MigrationBuilder) => {
  pgm.createTable(waitListMembersTable, {
    id: { type: 'serial', primaryKey: true },
    first_name: { type: 'varchar(100)' },
    last_name: { type: 'varchar(100)' },
    email: { type: 'varchar(254)', notNull: true },
    feature: { type: 'varchar(100)', notNull: true },
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
    waitListMembersTable,
    'waitlist_members_email_feature_key',
    {
      unique: ['email', 'feature'],
    }
  );
};

export const down = (pgm: MigrationBuilder) => {
  pgm.dropTable(waitListMembersTable);
};
