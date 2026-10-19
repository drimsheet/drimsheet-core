export {};

interface IMigrationBuilder {
  createTable: jest.Mock;
  func: jest.Mock;
  addConstraint: jest.Mock;
  dropTable: jest.Mock;
}
const { up, down } = jest.requireActual<{
  up(builder: IMigrationBuilder): Promise<void>;
  down(builder: IMigrationBuilder): Promise<void>;
}>('../../db/migrations/0025_reporting-periods');

describe('reporting-period generation migration', () => {
  const builder: IMigrationBuilder = {
    createTable: jest.fn(),
    func: jest.fn(),
    addConstraint: jest.fn(),
    dropTable: jest.fn(),
  };
  beforeEach(() => jest.resetAllMocks());

  it('enforces unique fiscal-year start dates independently of cadence', async () => {
    await up(builder);
    expect(builder.createTable).toHaveBeenCalledWith(
      { schema: 'core', name: 'reporting_periods' },
      expect.objectContaining({
        fiscal_year_id: expect.objectContaining({ notNull: true }),
        start_date: { type: 'date', notNull: true },
      })
    );
    expect(builder.addConstraint).toHaveBeenCalledWith(
      { schema: 'core', name: 'reporting_periods' },
      'reporting_periods_fiscal_year_start_date_key',
      { unique: ['fiscal_year_id', 'start_date'] }
    );
    expect(builder.createTable.mock.invocationCallOrder[0]).toBeLessThan(
      builder.addConstraint.mock.invocationCallOrder[0]
    );
  });

  it('drops the table and its constraint on rollback', async () => {
    await down(builder);
    expect(builder.dropTable).toHaveBeenCalledWith({
      schema: 'core',
      name: 'reporting_periods',
    });
  });
});
