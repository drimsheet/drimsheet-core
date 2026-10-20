import { TEntityId } from '@shared/types/uuid';

import { IAccountingContextDetails } from '@app/accounting/contracts/accounting-context.query.repo.contract';
import accountingContextDtoMapper from '@app/accounting/dtos/accounting-context/accounting-context.dto.mapper';

const entityId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const actorId = 'a1111111-1111-4111-8111-111111111111' as TEntityId;
const fiscalYearId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
const periodId = '123e4567-e89b-12d3-a456-426614174003' as TEntityId;
const timestamp = new Date('2026-01-01T00:00:00.000Z');
const context: IAccountingContextDetails = {
  id: '123e4567-e89b-12d3-a456-426614174004' as TEntityId,
  createdBy: actorId,
  name: 'Default Accounting Context',
  description: null,
  accountingEntityId: entityId,
  accountingStandardCode: 'IFRS',
  fiscalYearId,
  currentAccountingPeriodId: periodId,
  previousAccountingPeriodId: null,
  nextAccountingPeriodId: null,
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
  accountingPeriods: [
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
      status: 'closed',
      closedAt: new Date('2026-02-01T00:00:00.000Z'),
      updatedAt: timestamp,
    },
  ],
};

describe('accountingContextDtoMapper', () => {
  it('preserves populated period references in record and detail DTOs', () => {
    const previousAccountingPeriodId =
      '123e4567-e89b-12d3-a456-426614174005' as TEntityId;
    const nextAccountingPeriodId =
      '123e4567-e89b-12d3-a456-426614174006' as TEntityId;
    const input = {
      ...context,
      previousAccountingPeriodId,
      nextAccountingPeriodId,
    };

    for (const dto of [
      accountingContextDtoMapper.toRecordDto(input),
      accountingContextDtoMapper.toDto(input),
    ]) {
      expect(dto.previousAccountingPeriodId).toBe(previousAccountingPeriodId);
      expect(dto.nextAccountingPeriodId).toBe(nextAccountingPeriodId);
    }
  });

  it('returns explicit context, fiscal-year and period fields without persistence extras', () => {
    const input = {
      ...context,
      internal: 'private',
      fiscalYear: { ...context.fiscalYear, unit: 'month', count: 12 },
      accountingPeriods: context.accountingPeriods.map((period) => ({
        ...period,
        internal: 'private',
      })),
    };
    const dto = accountingContextDtoMapper.toDto(input);
    expect(dto).toEqual(context);
    expect(dto).not.toBe(input);
    expect(dto.fiscalYear).not.toBe(input.fiscalYear);
    expect(dto.accountingPeriods[0]).not.toBe(input.accountingPeriods[0]);
    expect(dto.currentAccountingPeriodId).toBe(periodId);
    expect(dto.accountingPeriods[0].status).toBe('closed');
  });

  it('maps a created context without leaking prerequisite collections or private fields', () => {
    const record = {
      id: context.id,
      createdBy: context.createdBy,
      name: context.name,
      description: context.description,
      accountingEntityId: context.accountingEntityId,
      accountingStandardCode: context.accountingStandardCode,
      fiscalYearId: context.fiscalYearId,
      currentAccountingPeriodId: context.currentAccountingPeriodId,
      previousAccountingPeriodId: null,
      nextAccountingPeriodId: null,
      createdAt: context.createdAt,
      updatedAt: context.updatedAt,
      closedAt: context.closedAt,
    };
    const input = { ...context, privateField: 'secret' };
    expect(accountingContextDtoMapper.toRecordDto(input)).toEqual(record);
    expect(accountingContextDtoMapper.toRecordDto(input)).not.toBe(input);
  });

  it('preserves an empty period collection', () => {
    expect(
      accountingContextDtoMapper.toDto({ ...context, accountingPeriods: [] })
        .accountingPeriods
    ).toEqual([]);
  });
});
