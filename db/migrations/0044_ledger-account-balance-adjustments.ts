import { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

import { actorsTable } from '../config/actors';
import { currenciesTable } from '../config/currencies';
import { journalEntriesTable } from '../config/journal-entries';
import {
  ledgerAccountBalanceAdjustmentsTable,
  ledgerAccountBalanceEffectType,
} from '../config/ledger-account-balances';
import { ledgerAccountsTable } from '../config/ledger-accounts';
import toSchemaString from '../utils/to-schema-string';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createType(ledgerAccountBalanceEffectType, [
    'increase',
    'decrease',
    'noop',
  ]);

  pgm.createTable(ledgerAccountBalanceAdjustmentsTable, {
    created_by: {
      type: 'uuid',
      notNull: true,
      references: actorsTable,
      onDelete: 'RESTRICT',
    },
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },

    ledger_account_id: {
      type: 'uuid',
      notNull: true,
      references: ledgerAccountsTable,
      onDelete: 'CASCADE',
    },

    amount: {
      type: 'bigint',
      notNull: true,
    },

    currency_code: {
      type: 'varchar(3)',
      notNull: true,
      references: currenciesTable,
      onDelete: 'RESTRICT',
    },

    functional_amount: {
      type: 'bigint',
      notNull: true,
    },

    functional_currency_code: {
      type: 'varchar(3)',
      notNull: true,
      references: currenciesTable,
      onDelete: 'RESTRICT',
    },

    journal_entry_id: {
      type: 'uuid',
      notNull: true,
      references: journalEntriesTable,
      onDelete: 'CASCADE',
    },

    effect: {
      type: toSchemaString(ledgerAccountBalanceEffectType),
      notNull: true,
    },

    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.addConstraint(
    ledgerAccountBalanceAdjustmentsTable,
    'ledger_account_balance_adjustments_account_entry_uk',
    {
      unique: ['ledger_account_id', 'journal_entry_id'],
    }
  );
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(ledgerAccountBalanceAdjustmentsTable);

  pgm.dropType(ledgerAccountBalanceEffectType);
}
