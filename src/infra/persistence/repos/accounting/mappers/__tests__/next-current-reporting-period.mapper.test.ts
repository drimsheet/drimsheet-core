import nextCurrentReportingPeriodMapper from '@infra/persistence/repos/accounting/mappers/next-current-reporting-period.mapper';

describe('nextCurrentReportingPeriodMapper', () => {
  it('returns only the requested entity and interval reference fields', () => {
    const row = {
      accountingEntityId: 'entity',
      reportingIntervalId: 'next',
      internal: 'private',
    };

    expect(nextCurrentReportingPeriodMapper.fromRepo(row)).toEqual({
      accountingEntityId: 'entity',
      reportingIntervalId: 'next',
    });
  });
});
