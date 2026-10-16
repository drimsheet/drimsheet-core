import reportingContextDetailsMapper from '@infra/persistence/repos/accounting/mappers/reporting-context-details.mapper';

describe('reportingContextDetailsMapper', () => {
  const timestamp = '2026-01-01T00:00:00.000Z';
  const payload: Parameters<typeof reportingContextDetailsMapper.toDetails>[0] =
    {
      context: {
        id: 'reporting-context',
        createdBy: 'actor',
        name: 'Reporting context',
        description: null,
        accountingEntityId: 'entity',
        accountingStandardCode: 'IFRS',
        accountingContextId: 'accounting-context',
        reportingCurrencyCode: 'NGN',
        currentReportingPeriodId: 'period',
        createdAt: timestamp,
        updatedAt: timestamp,
        closedAt: null,
      },
      fiscalYear: {
        id: 'year',
        createdBy: 'actor',
        name: '2026',
        accountingEntityId: 'entity',
        unit: 'month',
        count: 12,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        status: 'open',
        closedAt: null,
        updatedAt: timestamp,
      },
      reportingPeriods: [
        {
          id: 'period',
          createdBy: 'actor',
          name: 'Q1',
          accountingEntityId: 'entity',
          fiscalYearId: 'year',
          unit: 'quarter',
          count: 4,
          startDate: '2026-01-01',
          endDate: '2026-03-31',
          updatedAt: timestamp,
        },
      ],
    };

  it('maps reporting currency, linked context and calendar dates without inventing period statuses', () => {
    expect(reportingContextDetailsMapper.toDetails(payload)).toEqual({
      id: 'reporting-context',
      createdBy: 'actor',
      name: 'Reporting context',
      description: null,
      accountingEntityId: 'entity',
      accountingStandardCode: 'IFRS',
      accountingContextId: 'accounting-context',
      reportingCurrencyCode: 'NGN',
      currentReportingPeriodId: 'period',
      createdAt: new Date(timestamp),
      updatedAt: new Date(timestamp),
      closedAt: null,
      fiscalYear: {
        id: 'year',
        createdBy: 'actor',
        name: '2026',
        accountingEntityId: 'entity',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T00:00:00.000Z'),
        status: 'open',
        closedAt: null,
        updatedAt: new Date(timestamp),
      },
      reportingPeriods: [
        {
          id: 'period',
          createdBy: 'actor',
          name: 'Q1',
          accountingEntityId: 'entity',
          fiscalYearId: 'year',
          unit: 'quarter',
          count: 4,
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2026-03-31T00:00:00.000Z'),
          updatedAt: new Date(timestamp),
        },
      ],
    });
  });

  it('maps non-null context and fiscal-year closure dates and an empty period collection', () => {
    const details = reportingContextDetailsMapper.toDetails({
      context: {
        ...payload.context,
        description: 'Description',
        closedAt: timestamp,
      },
      fiscalYear: { ...payload.fiscalYear, closedAt: timestamp },
      reportingPeriods: [],
    });
    expect(details.description).toBe('Description');
    expect(details.closedAt).toEqual(new Date(timestamp));
    expect(details.fiscalYear.closedAt).toEqual(new Date(timestamp));
    expect(details.reportingPeriods).toEqual([]);
  });
});
