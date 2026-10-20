import nextCurrentAccountingPeriodMapper from '@infra/persistence/repos/accounting/mappers/next-current-accounting-period.mapper';

describe('nextCurrentAccountingPeriodMapper', () => {
  it('returns only the four requested period reference fields', () => {
    const row = {
      fiscalYearId: 'year',
      accountingEntityId: 'entity',
      currentPeriodId: 'current',
      nextPeriodId: 'next',
      internal: 'private',
    };

    expect(nextCurrentAccountingPeriodMapper.toDetails(row)).toEqual({
      fiscalYearId: 'year',
      accountingEntityId: 'entity',
      currentPeriodId: 'current',
      nextPeriodId: 'next',
    });
  });
});
