import type { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

import { accountingEntitiesTable } from '../config/accounting-entity';
import {
  journalEntriesTable,
  journalLinesTable,
} from '../config/journal-entries';
import { coreSchema } from '../config/schemas';
import toSchemaString from '../utils/to-schema-string';

export const shorthands: ColumnDefinitions | undefined = undefined;

const entities = toSchemaString(accountingEntitiesTable);
const entries = toSchemaString(journalEntriesTable);
const lines = toSchemaString(journalLinesTable);
const lineGuard = toSchemaString({
  schema: coreSchema,
  name: 'check_journal_line_functional_currency',
});
const entryGuard = toSchemaString({
  schema: coreSchema,
  name: 'check_journal_entry_functional_currency',
});
const entityGuard = toSchemaString({
  schema: coreSchema,
  name: 'check_accounting_entity_functional_currency',
});

export function up(pgm: MigrationBuilder) {
  // Migration DDL and validation share one transaction. Do not admit writes
  // between checking existing rows and installing the guards.
  pgm.sql(`
    LOCK TABLE ${entities}, ${entries}, ${lines} IN SHARE ROW EXCLUSIVE MODE;

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM ${lines} AS line
        JOIN ${entries} AS entry ON entry.id = line.entry_id
        JOIN ${entities} AS entity ON entity.id = entry.accounting_entity_id
        WHERE line.functional_currency_code IS DISTINCT FROM entity.functional_currency_code
      ) THEN
        RAISE EXCEPTION 'Existing journal lines have inconsistent functional currencies'
          USING ERRCODE = '23514', CONSTRAINT = 'journal_lines_entity_functional_currency_check';
      END IF;
    END;
    $$;

    CREATE FUNCTION ${lineGuard}() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE
      entity_id uuid;
      entity_currency varchar(3);
    BEGIN
      -- Keep the owning header stable while resolving and checking its entity.
      SELECT accounting_entity_id INTO entity_id
      FROM ${entries} WHERE id = NEW.entry_id FOR SHARE;
      IF NOT FOUND THEN
        RETURN NEW; -- The existing entry foreign key reports a missing header.
      END IF;

      SELECT functional_currency_code INTO entity_currency
      FROM ${entities} WHERE id = entity_id FOR SHARE;

      IF NEW.functional_currency_code IS DISTINCT FROM entity_currency THEN
        RAISE EXCEPTION 'Journal line functional currency differs from its accounting entity'
          USING ERRCODE = '23514', CONSTRAINT = 'journal_lines_entity_functional_currency_check';
      END IF;
      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER journal_lines_entity_functional_currency_check
      BEFORE INSERT OR UPDATE OF entry_id, functional_currency_code ON ${lines}
      FOR EACH ROW EXECUTE FUNCTION ${lineGuard}();

    CREATE FUNCTION ${entryGuard}() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE
      entity_currency varchar(3);
    BEGIN
      -- This lock also covers headers with no lines. Currency updates cannot
      -- race the first header insert, including a draft, under READ COMMITTED.
      SELECT functional_currency_code INTO entity_currency
      FROM ${entities} WHERE id = NEW.accounting_entity_id FOR SHARE;
      IF NOT FOUND THEN
        RETURN NEW; -- The existing entity foreign key reports a missing entity.
      END IF;

      IF TG_OP = 'UPDATE' THEN
        IF EXISTS (
          SELECT 1 FROM ${lines}
          WHERE entry_id = OLD.id
            AND functional_currency_code IS DISTINCT FROM entity_currency
        ) THEN
          RAISE EXCEPTION 'Journal entry entity differs from its lines functional currency'
            USING ERRCODE = '23514', CONSTRAINT = 'journal_lines_entity_functional_currency_check';
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER journal_entries_entity_functional_currency_check
      BEFORE INSERT OR UPDATE OF accounting_entity_id ON ${entries}
      FOR EACH ROW EXECUTE FUNCTION ${entryGuard}();

    CREATE FUNCTION ${entityGuard}() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      -- UPDATE holds a row lock conflicting with the writers' FOR SHARE locks.
      -- The trigger's query sees committed headers after a writer finishes.
      IF EXISTS (SELECT 1 FROM ${entries} WHERE accounting_entity_id = OLD.id) THEN
        RAISE EXCEPTION 'Functional currency cannot change while journal entries exist'
          USING ERRCODE = '23514', CONSTRAINT = 'accounting_entities_journal_currency_change_check';
      END IF;
      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER accounting_entities_journal_currency_change_check
      BEFORE UPDATE OF functional_currency_code ON ${entities}
      FOR EACH ROW
      WHEN (OLD.functional_currency_code IS DISTINCT FROM NEW.functional_currency_code)
      EXECUTE FUNCTION ${entityGuard}();
  `);
}

export function down(pgm: MigrationBuilder) {
  pgm.sql(`
    DROP TRIGGER accounting_entities_journal_currency_change_check ON ${entities};
    DROP TRIGGER journal_entries_entity_functional_currency_check ON ${entries};
    DROP TRIGGER journal_lines_entity_functional_currency_check ON ${lines};
    DROP FUNCTION ${entityGuard}();
    DROP FUNCTION ${entryGuard}();
    DROP FUNCTION ${lineGuard}();
  `);
}
