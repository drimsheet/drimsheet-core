import accountingContextDetailsMapper from '@infra/persistence/repos/accounting/mappers/accounting-context-details.mapper';

describe('accountingContextDetailsMapper', () => {
  const timestamp = '2026-01-01T00:00:00.000Z';
  const row: Parameters<typeof accountingContextDetailsMapper.toDetails>[0] = {
    id: 'context',
    createdBy: 'actor',
    name: 'Context',
    description: null,
    accountingEntityId: 'entity',
    accountingStandardCode: 'IFRS',
    fiscalYearId: 'year',
    currentOperatingPeriodId: 'period',
    previousAccountingPeriodId: null,
    nextAccountingPeriodId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    closedAt: null,
    fiscalYearsInCore: {
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
      accountingPeriodsInCores: [
        {
          id: 'period',
          createdBy: 'actor',
          name: 'January',
          accountingEntityId: 'entity',
          fiscalYearId: 'year',
          unit: 'month',
          count: 12,
          startDate: '2026-01-01',
          endDate: '2026-01-31',
          status: 'closed',
          closedAt: '2026-02-01T00:00:00.000Z',
          updatedAt: timestamp,
        },
      ],
    },
  };

  it('maps storage names and date-only values into context details, retaining closed periods', () => {
    expect(accountingContextDetailsMapper.toDetails(row)).toEqual({
      id: 'context',
      createdBy: 'actor',
      name: 'Context',
      description: null,
      accountingEntityId: 'entity',
      accountingStandardCode: 'IFRS',
      fiscalYearId: 'year',
      currentAccountingPeriodId: 'period',
      previousAccountingPeriodId: null,
      nextAccountingPeriodId: null,
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
      accountingPeriods: [
        {
          id: 'period',
          createdBy: 'actor',
          name: 'January',
          accountingEntityId: 'entity',
          fiscalYearId: 'year',
          unit: 'month',
          count: 12,
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2026-01-31T00:00:00.000Z'),
          status: 'closed',
          closedAt: new Date('2026-02-01T00:00:00.000Z'),
          updatedAt: new Date(timestamp),
        },
      ],
    });
  });

  it('maps non-null closure dates and empty periods', () => {
    const details = accountingContextDetailsMapper.toDetails({
      ...row,
      description: 'Description',
      previousAccountingPeriodId: 'previous-period',
      nextAccountingPeriodId: 'next-period',
      closedAt: timestamp,
      fiscalYearsInCore: {
        ...row.fiscalYearsInCore,
        closedAt: timestamp,
        accountingPeriodsInCores: [],
      },
    });
    expect(details.description).toBe('Description');
    expect(details.previousAccountingPeriodId).toBe('previous-period');
    expect(details.nextAccountingPeriodId).toBe('next-period');
    expect(details.closedAt).toEqual(new Date(timestamp));
    expect(details.fiscalYear.closedAt).toEqual(new Date(timestamp));
    expect(details.accountingPeriods).toEqual([]);
  });
});
