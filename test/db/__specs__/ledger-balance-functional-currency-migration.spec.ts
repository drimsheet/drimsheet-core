export {};

type TSqlMigration = (builder: {
  sql(statement: string): void;
}) => Promise<void>;
const { up, down } = jest.requireActual<{
  up: TSqlMigration;
  down: TSqlMigration;
}>('../../../db/migrations/0050_enforce-ledger-balance-functional-currency');

async function migrationSql(migrate: TSqlMigration) {
  const statements: string[] = [];
  await migrate({ sql: (statement) => statements.push(statement) });
  return statements.join('\n');
}

describe('ledger balance functional currency migration', () => {
  it('locks and validates existing balances before installing the guard', async () => {
    const sql = await migrationSql(up);
    expect(sql).toContain(
      'LOCK TABLE "core"."accounting_entities", "core"."ledger_account_balances" IN SHARE ROW EXCLUSIVE MODE'
    );
    expect(sql).toContain(
      'balance.functional_currency_code IS DISTINCT FROM entity.functional_currency_code'
    );
    expect(sql.indexOf('Existing ledger balances')).toBeLessThan(
      sql.indexOf('CREATE TRIGGER')
    );
    expect(sql).not.toMatch(/UPDATE\s+"core"|DELETE FROM|TRUNCATE/);
  });

  it('guards insertion, entity reassignment and currency changes with a transaction-held share lock', async () => {
    const sql = await migrationSql(up);
    expect(sql).toContain(
      'BEFORE INSERT OR UPDATE OF accounting_entity_id, functional_currency_code ON "core"."ledger_account_balances"'
    );
    expect(sql).toContain(
      'FROM "core"."accounting_entities" WHERE id = NEW.accounting_entity_id FOR SHARE'
    );
    expect(sql).toContain('IF NOT FOUND THEN');
    expect(sql).toContain(
      'IF NEW.functional_currency_code IS DISTINCT FROM entity_currency THEN'
    );
    expect(sql).toContain(
      "ERRCODE = '23514', CONSTRAINT = 'ledger_account_balances_entity_functional_currency_check'"
    );
    expect(sql).not.toContain('NEW.currency_code');
    expect(sql).not.toContain('NEW.functional_amount');
  });

  it('removes only its own trigger and function, in dependency order', async () => {
    const sql = await migrationSql(down);
    expect(sql).toContain(
      'DROP TRIGGER ledger_account_balances_entity_functional_currency_check ON "core"."ledger_account_balances"'
    );
    expect(sql).toContain(
      'DROP FUNCTION "core"."check_ledger_account_balance_functional_currency"()'
    );
    expect(sql.indexOf('DROP TRIGGER')).toBeLessThan(
      sql.indexOf('DROP FUNCTION')
    );
    expect(sql).not.toMatch(/DROP TABLE|DELETE|CASCADE/);
  });
});
