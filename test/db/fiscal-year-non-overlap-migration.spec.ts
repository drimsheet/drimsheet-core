export {};

interface IMigrationBuilder {
  createExtension: jest.Mock;
  createType: jest.Mock;
  createTable: jest.Mock;
  func: jest.Mock;
  addConstraint: jest.Mock;
  dropTable: jest.Mock;
  dropType: jest.Mock;
  sql: jest.Mock;
}
const { up, down } = jest.requireActual<{
  up(builder: IMigrationBuilder): Promise<void>;
  down(builder: IMigrationBuilder): Promise<void>;
}>('../../db/migrations/0019_fiscal-years');

describe('fiscal-year non-overlap migration', () => {
  const builder: IMigrationBuilder = {
    createExtension: jest.fn(),
    createType: jest.fn(),
    createTable: jest.fn(),
    func: jest.fn(),
    addConstraint: jest.fn(),
    dropTable: jest.fn(),
    dropType: jest.fn(),
    sql: jest.fn(),
  };
  beforeEach(() => jest.resetAllMocks());

  it('creates the fiscal-year table with inclusive entity-scoped exclusion across every status', async () => {
    await up(builder);
    expect(builder.createExtension).toHaveBeenCalledWith('btree_gist', {
      ifNotExists: true,
    });
    expect(builder.addConstraint).toHaveBeenCalledWith(
      { schema: 'core', name: 'fiscal_years' },
      'fiscal_years_dates_ordered',
      { check: 'start_date <= end_date' }
    );
    expect(builder.createTable).toHaveBeenCalledWith(
      { schema: 'core', name: 'fiscal_years' },
      expect.objectContaining({
        accounting_entity_id: expect.objectContaining({ notNull: true }),
        start_date: { type: 'date', notNull: true },
        end_date: { type: 'date', notNull: true },
      })
    );
    expect(builder.createTable.mock.invocationCallOrder[0]).toBeLessThan(
      builder.addConstraint.mock.invocationCallOrder[0]
    );
    expect(builder.createTable.mock.invocationCallOrder[0]).toBeLessThan(
      builder.sql.mock.invocationCallOrder[0]
    );
    const sql = builder.sql.mock.calls[0][0] as string;
    expect(sql).toContain('ALTER TABLE "core"."fiscal_years"');
    expect(sql).toContain('EXCLUDE USING gist');
    expect(sql).toContain('accounting_entity_id WITH =');
    expect(sql).toContain("daterange(start_date, end_date, '[]') WITH &&");
    expect(sql).not.toMatch(/WHERE|NOT VALID|UPDATE|DELETE|TRUNCATE/);
  });

  it('drops the table and its constraints before removing the period types', async () => {
    await down(builder);
    expect(builder.dropTable).toHaveBeenCalledWith({
      schema: 'core',
      name: 'fiscal_years',
    });
    expect(builder.dropType).toHaveBeenCalledTimes(3);
    expect(builder.dropTable.mock.invocationCallOrder[0]).toBeLessThan(
      builder.dropType.mock.invocationCallOrder[0]
    );
    expect(builder.sql).not.toHaveBeenCalled();
  });
});
