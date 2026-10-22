import nextCurrentAccountingPeriodMapper from '@infra/persistence/repos/accounting/mappers/next-current-accounting-period.mapper';

describe('nextCurrentAccountingPeriodMapper', () => {
  it('returns only the requested entity and interval reference fields', () => {
    const row = {
      accountingEntityId: 'entity',
      accountingIntervalId: 'next',
      internal: 'private',
    };

    expect(nextCurrentAccountingPeriodMapper.fromRepo(row)).toEqual({
      accountingEntityId: 'entity',
      accountingIntervalId: 'next',
    });
  });
});
