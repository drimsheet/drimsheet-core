import type { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

import { accountingEntitiesTable } from '../config/accounting-entity';
import { ledgerAccountBalancesTable } from '../config/ledger-account-balances';
import { coreSchema } from '../config/schemas';
import toSchemaString from '../utils/to-schema-string';

export const shorthands: ColumnDefinitions | undefined = undefined;

const entities = toSchemaString(accountingEntitiesTable);
const balances = toSchemaString(ledgerAccountBalancesTable);
const guard = toSchemaString({
  schema: coreSchema,
  name: 'check_ledger_account_balance_functional_currency',
});

export function up(pgm: MigrationBuilder) {
  pgm.sql(`
    -- Validate and install the guard without allowing intervening writes.
    LOCK TABLE ${entities}, ${balances} IN SHARE ROW EXCLUSIVE MODE;

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM ${balances} AS balance
        JOIN ${entities} AS entity ON entity.id = balance.accounting_entity_id
        WHERE balance.functional_currency_code IS DISTINCT FROM entity.functional_currency_code
      ) THEN
        RAISE EXCEPTION 'Existing ledger balances have inconsistent functional currencies'
          USING ERRCODE = '23514', CONSTRAINT = 'ledger_account_balances_entity_functional_currency_check';
      END IF;
    END;
    $$;

    CREATE FUNCTION ${guard}() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE
      entity_currency varchar(3);
    BEGIN
      -- Hold the entity denomination stable through the balance write's commit.
      -- Entity currency updates take a conflicting row lock before updating balances.
      SELECT functional_currency_code INTO entity_currency
      FROM ${entities} WHERE id = NEW.accounting_entity_id FOR SHARE;
      IF NOT FOUND THEN
        RETURN NEW; -- The existing foreign key reports a missing entity.
      END IF;

      IF NEW.functional_currency_code IS DISTINCT FROM entity_currency THEN
        RAISE EXCEPTION 'Ledger balance functional currency differs from its accounting entity'
          USING ERRCODE = '23514', CONSTRAINT = 'ledger_account_balances_entity_functional_currency_check';
      END IF;
      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER ledger_account_balances_entity_functional_currency_check
      BEFORE INSERT OR UPDATE OF accounting_entity_id, functional_currency_code ON ${balances}
      FOR EACH ROW EXECUTE FUNCTION ${guard}();
  `);
}

export function down(pgm: MigrationBuilder) {
  pgm.sql(`
    DROP TRIGGER ledger_account_balances_entity_functional_currency_check ON ${balances};
    DROP FUNCTION ${guard}();
  `);
}
