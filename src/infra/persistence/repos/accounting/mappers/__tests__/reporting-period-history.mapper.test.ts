import { TEntityId } from '@shared/types/uuid';

import { IReportingPeriodHistory } from '@domain/accounting/types/reporting-period-audit.types';
import { IReportingPeriod } from '@domain/accounting/types/reporting-period.types';

import { toRepoDate } from '@infra/persistence/helpers/date.mapper';
import reportingPeriodHistoryMapper from '@infra/persistence/repos/accounting/mappers/reporting-period-history.mapper';

describe('reportingPeriodHistoryMapper', () => {
  it('maps reporting period history to the repository model', () => {
    const reportingPeriodId = 'reporting-period-uuid' as TEntityId;
    const accountingEntityId = 'accounting-entity-uuid' as TEntityId;
    const userId = 'user-uuid' as TEntityId;
    const occurredAt = new Date('2026-07-25T12:00:00.000Z');

    const reportingPeriod: IReportingPeriod = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      accountingEntityId,
    } as IReportingPeriod;

    const history: IReportingPeriodHistory = {
      entityId: reportingPeriodId,
      entityVersion: 1,
      action: 'created',
      diff: {
        before: null,
        after: reportingPeriod,
      },
      occurredAt,
      actorId: userId,
      onBehalfOf: null,
      correlationId: 'correlation-id-abc',
    };

    expect(
      reportingPeriodHistoryMapper.toRepo(reportingPeriod, history)
    ).toEqual({
      reportingPeriodId,
      accountingEntityId,
      actorId: userId,
      onBehalfOf: null,
      action: 'created',
      diff: history.diff,
      correlationId: 'correlation-id-abc',
      occurredAt: toRepoDate(occurredAt),
    });
  });
});
