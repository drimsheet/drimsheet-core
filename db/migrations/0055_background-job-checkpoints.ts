import { MigrationBuilder } from 'node-pg-migrate';

import { backgroundJobCheckpointsTable } from '../config/background-jobs';

export function up(pgm: MigrationBuilder): void {
  pgm.createTable(backgroundJobCheckpointsTable, {
    job_key: {
      type: 'text',
      primaryKey: true,
    },
    last_succeeded_at: {
      type: 'timestamptz',
      notNull: true,
    },
  });
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropTable(backgroundJobCheckpointsTable);
}
