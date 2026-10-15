type TSqlMigration = (builder: {
  sql(statement: string): void;
}) => Promise<void>;

const { up, down } = jest.requireActual<{
  up: TSqlMigration;
  down: TSqlMigration;
}>('../../../db/migrations/0049_enforce-journal-functional-currency');

/** Captures the migration's SQL without requiring an external database. */
async function migrationSql(migrate: typeof up) {
  const statements: string[] = [];
  const builder = {
    sql: (sql: string) => statements.push(sql),
  };
  await migrate(builder);
  return statements.join('\n');
}

describe('journal functional currency migration', () => {
  it('validates existing data before enabling guards without rewriting monetary data', async () => {
    const sql = await migrationSql(up);
    expect(sql).toContain(
      'LOCK TABLE "core"."accounting_entities", "core"."journal_entries", "core"."journal_lines" IN SHARE ROW EXCLUSIVE MODE'
    );
    expect(sql.indexOf('Existing journal lines')).toBeLessThan(
      sql.indexOf('CREATE TRIGGER')
    );
    expect(sql).toContain(
      'line.functional_currency_code IS DISTINCT FROM entity.functional_currency_code'
    );
    expect(sql).not.toMatch(/UPDATE\s+"core"|DELETE FROM|TRUNCATE/);
  });

  it('guards inserts, line reassignment and header reassignment using the actual owning entity', async () => {
    const sql = await migrationSql(up);
    expect(sql).toContain(
      'BEFORE INSERT OR UPDATE OF entry_id, functional_currency_code ON "core"."journal_lines"'
    );
    expect(sql).toContain('WHERE id = NEW.entry_id FOR SHARE');
    expect(sql).toContain('WHERE id = entity_id FOR SHARE');
    expect(sql).toContain(
      'NEW.functional_currency_code IS DISTINCT FROM entity_currency'
    );
    expect(sql).toContain(
      'BEFORE INSERT OR UPDATE OF accounting_entity_id ON "core"."journal_entries"'
    );
    expect(sql).toContain('WHERE id = NEW.accounting_entity_id FOR SHARE');
    expect(sql).toContain('WHERE entry_id = OLD.id');
    expect(sql).toContain(
      "CONSTRAINT = 'journal_lines_entity_functional_currency_check'"
    );
  });

  it('allows unchanged entity currency and rejects changes for entries of every status', async () => {
    const sql = await migrationSql(up);
    expect(sql).toContain(
      'WHEN (OLD.functional_currency_code IS DISTINCT FROM NEW.functional_currency_code)'
    );
    expect(sql).toContain(
      'EXISTS (SELECT 1 FROM "core"."journal_entries" WHERE accounting_entity_id = OLD.id)'
    );
    expect(sql).not.toMatch(/status\s*=|posted_at\s+IS/);
    expect(sql).toContain(
      "ERRCODE = '23514', CONSTRAINT = 'accounting_entities_journal_currency_change_check'"
    );
  });

  it('rolls back only its own triggers and functions, in dependency order', async () => {
    const sql = await migrationSql(down);
    expect(sql.match(/DROP TRIGGER/g)).toHaveLength(3);
    expect(sql.match(/DROP FUNCTION/g)).toHaveLength(3);
    expect(sql.lastIndexOf('DROP TRIGGER')).toBeLessThan(
      sql.indexOf('DROP FUNCTION')
    );
    expect(sql).not.toMatch(/DROP TABLE|DELETE|CASCADE/);
  });
});
