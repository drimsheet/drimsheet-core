import { TEntityId } from '@shared/types/uuid';

import { IReportingContext } from '@domain/accounting/types/context.types';

import reportingContextMapper from '@infra/persistence/repos/accounting/mappers/reporting-context.mapper';

describe('reportingContextMapper', () => {
  it.each([null, '2026-12-31T06:30:00.123Z'])(
    'round-trips the interval reference and all fields with closedAt=%s',
    (closedAt) => {
      const row = {
        id: 'context',
        createdBy: 'actor',
        name: 'Context',
        description: null,
        accountingEntityId: 'entity',
        accountingContextId: 'accounting-context',
        reportingCurrencyCode: 'USD',
        reportingIntervalId: 'interval',
        createdAt: '2026-01-01T06:30:00.123Z',
        updatedAt: '2026-04-01T06:30:00.123Z',
        closedAt,
      };
      const domain: IReportingContext = {
        id: row.id as TEntityId,
        createdBy: row.createdBy as TEntityId,
        name: row.name,
        description: row.description,
        accountingEntityId: row.accountingEntityId as TEntityId,
        accountingContextId: row.accountingContextId as TEntityId,
        reportingCurrencyCode: 'USD',
        reportingIntervalId: row.reportingIntervalId as TEntityId,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
        closedAt: closedAt ? new Date(closedAt) : null,
      };
      const result = reportingContextMapper.toDomain(row);
      expect(result).toEqual(domain);
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.createdAt)).toBe(true);
      expect(Object.isFrozen(result.updatedAt)).toBe(true);
      expect(reportingContextMapper.toRepo(domain)).toEqual(row);
      expect(reportingContextMapper.toRepo(result)).toEqual(row);
    }
  );
});
