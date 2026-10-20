import nextCurrentAccountingPeriodMapper from '@infra/persistence/repos/accounting/mappers/next-current-accounting-period.mapper';

describe('nextCurrentAccountingPeriodMapper', () => {
  it('returns only the requested context and period reference fields', () => {
    const row = {
      accountingContextId: 'context',
      fiscalYearId: 'year',
      accountingEntityId: 'entity',
      currentPeriodId: 'current',
      nextPeriodId: 'next',
      internal: 'private',
    };

    expect(nextCurrentAccountingPeriodMapper.toDetails(row)).toEqual({
      accountingContextId: 'context',
      fiscalYearId: 'year',
      accountingEntityId: 'entity',
      currentPeriodId: 'current',
      nextPeriodId: 'next',
    });
  });
});
