import nextCurrentReportingPeriodMapper from '@infra/persistence/repos/accounting/mappers/next-current-reporting-period.mapper';

describe('nextCurrentReportingPeriodMapper', () => {
  it('returns only the requested context and period reference fields', () => {
    const row = {
      reportingContextId: 'context',
      fiscalYearId: 'year',
      accountingEntityId: 'entity',
      currentPeriodId: 'current',
      nextPeriodId: 'next',
      internal: 'private',
    };

    expect(nextCurrentReportingPeriodMapper.toDetails(row)).toEqual({
      reportingContextId: 'context',
      fiscalYearId: 'year',
      accountingEntityId: 'entity',
      currentPeriodId: 'current',
      nextPeriodId: 'next',
    });
  });
});
