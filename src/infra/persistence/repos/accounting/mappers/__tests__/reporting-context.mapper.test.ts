import { TEntityId } from '@shared/types/uuid';

import { UAccountingStandardCode } from '@domain/accounting/config/accounting-standards.config';
import { IReportingContext } from '@domain/accounting/types/context.types';
import { UCurrencyCode } from '@domain/money/config/currencies.config';

import reportingContextMapper from '@infra/persistence/repos/accounting/mappers/reporting-context.mapper';

describe('reportingContextMapper', () => {
  it('should map IReportingContext to IReportingContextRepoModel', () => {
    const domain: IReportingContext = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: 'uuid-1' as TEntityId,
      name: 'Reporting Context',
      description: 'Secondary context',
      accountingEntityId: 'entity-1' as TEntityId,
      reportingCurrencyCode: 'USD' as UCurrencyCode,
      accountingContextId: 'ac-1' as TEntityId,
      currentReportingPeriodId: 'rp-1' as TEntityId,
      accountingStandardCode: 'IFRS' as UAccountingStandardCode,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      closedAt: null,
    };

    const result = reportingContextMapper.toRepo(domain);

    expect(result).toEqual({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: 'uuid-1',
      name: 'Reporting Context',
      description: 'Secondary context',
      accountingEntityId: 'entity-1',
      reportingCurrencyCode: 'USD',
      accountingContextId: 'ac-1',
      currentReportingPeriodId: 'rp-1',
      accountingStandardCode: 'IFRS',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      closedAt: null,
    });
  });

  it('should use provided accountingStandardCode', () => {
    const domain = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: 'uuid-1' as TEntityId,
      name: 'Reporting Context',
      description: null,
      accountingEntityId: 'entity-1' as TEntityId,
      reportingCurrencyCode: 'USD' as UCurrencyCode,
      accountingContextId: 'ac-1' as TEntityId,
      currentReportingPeriodId: 'rp-1' as TEntityId,
      accountingStandardCode: 'GAAP' as UAccountingStandardCode,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      closedAt: new Date('2026-12-31T00:00:00Z'),
    } as IReportingContext;

    const result = reportingContextMapper.toRepo(domain);
    expect(result.accountingStandardCode).toBe('GAAP');
    expect(result.closedAt).toBe('2026-12-31T00:00:00.000Z');
  });
  it.each([null, '2026-12-31T00:00:00.000Z'])(
    'maps persisted context dates and identity, closedAt=%s',
    (closedAt) => {
      const row = {
        id: 'context',
        createdBy: 'actor',
        name: 'Reporting',
        description: null,
        accountingEntityId: 'entity',
        reportingCurrencyCode: 'USD',
        accountingContextId: 'accounting-context',
        currentReportingPeriodId: 'period',
        accountingStandardCode: 'IFRS',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
        closedAt,
      };
      const context = reportingContextMapper.toDomain(row);
      expect(context).toEqual({
        ...row,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
        closedAt: closedAt ? new Date(closedAt) : null,
      });
      expect(Object.isFrozen(context)).toBe(true);
      expect(Object.isFrozen(context.updatedAt)).toBe(true);
      expect(reportingContextMapper.toRepo(context)).toEqual(row);
    }
  );
});
