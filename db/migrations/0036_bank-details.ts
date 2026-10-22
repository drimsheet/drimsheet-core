import { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

import { accountingEntitiesTable } from '../config/accounting-entity';
import { actorsTable } from '../config/actors';
import { bankAccountsTable } from '../config/bank-accounts';
import { ledgerAccountsTable } from '../config/ledger-accounts';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(
    bankAccountsTable,
    {
      created_by: {
        type: 'uuid',
        notNull: true,
        references: actorsTable,
        onDelete: 'RESTRICT',
      },
      bank_name: {
        type: 'varchar(100)',
        notNull: true,
      },
      account_number: {
        type: 'varchar(34)',
        notNull: true,
      },
      account_name: {
        type: 'varchar(100)',
        notNull: true,
      },
      country_code: {
        type: 'varchar(2)',
        notNull: true,
      },
      accounting_entity_id: {
        type: 'uuid',
        notNull: true,
        references: accountingEntitiesTable,
        onDelete: 'CASCADE',
      },
      ledger_account_id: {
        type: 'uuid',
        notNull: true,
        references: ledgerAccountsTable,
        onDelete: 'CASCADE',
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
    },
    {
      ifNotExists: true,
    }
  );

  pgm.addConstraint(bankAccountsTable, 'bank_accounts_pkey', {
    primaryKey: ['bank_name', 'account_number'],
  });

  pgm.addConstraint(bankAccountsTable, 'bank_accounts_ledger_account_id_uk', {
    unique: ['ledger_account_id'],
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(bankAccountsTable);
}
