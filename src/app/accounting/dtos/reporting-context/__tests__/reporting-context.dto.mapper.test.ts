import { TEntityId } from '@shared/types/uuid';

import { IReportingContextDetails } from '@app/accounting/contracts/reporting-context.query.repo.contract';
import reportingContextDtoMapper from '@app/accounting/dtos/reporting-context/reporting-context.dto.mapper';

const entityId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const actorId = 'a1111111-1111-4111-8111-111111111111' as TEntityId;
const fiscalYearId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
const periodId = '123e4567-e89b-12d3-a456-426614174003' as TEntityId;
const timestamp = new Date('2026-01-01T00:00:00.000Z');
const context: IReportingContextDetails = {
  id: '123e4567-e89b-12d3-a456-426614174004' as TEntityId,
  createdBy: actorId,
  name: 'Default Reporting Context',
  description: null,
  accountingEntityId: entityId,
  accountingStandardCode: 'IFRS',
  accountingContextId: '123e4567-e89b-12d3-a456-426614174006' as TEntityId,
  reportingCurrencyCode: 'NGN',
  currentReportingPeriodId: periodId,
  createdAt: timestamp,
  updatedAt: timestamp,
  closedAt: null,
  fiscalYear: {
    id: fiscalYearId,
    createdBy: actorId,
    name: '2026',
    accountingEntityId: entityId,
    startDate: timestamp,
    endDate: new Date('2026-12-31T00:00:00.000Z'),
    status: 'open',
    closedAt: null,
    updatedAt: timestamp,
  },
  reportingPeriods: [
    {
      id: periodId,
      createdBy: actorId,
      name: 'January',
      accountingEntityId: entityId,
      fiscalYearId,
      unit: 'month',
      count: 12,
      startDate: timestamp,
      endDate: new Date('2026-01-31T00:00:00.000Z'),
      updatedAt: timestamp,
    },
  ],
};

describe('reportingContextDtoMapper', () => {
  it('returns explicit context, fiscal-year and period fields without persistence extras', () => {
    const input = {
      ...context,
      internal: 'private',
      fiscalYear: { ...context.fiscalYear, unit: 'month', count: 12 },
      reportingPeriods: context.reportingPeriods.map((period) => ({
        ...period,
        internal: 'private',
      })),
    };
    const dto = reportingContextDtoMapper.toDto(input);
    expect(dto).toEqual(context);
    expect(dto).not.toBe(input);
    expect(dto.fiscalYear).not.toBe(input.fiscalYear);
    expect(dto.reportingPeriods[0]).not.toBe(input.reportingPeriods[0]);
    expect(dto.currentReportingPeriodId).toBe(periodId);
    expect(dto.reportingCurrencyCode).toBe('NGN');
    expect(dto.accountingContextId).toBe(context.accountingContextId);
  });

  it('preserves an empty period collection', () => {
    expect(
      reportingContextDtoMapper.toDto({ ...context, reportingPeriods: [] })
        .reportingPeriods
    ).toEqual([]);
  });
});
