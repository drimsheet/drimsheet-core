import { InferSelectModel } from 'drizzle-orm';

import { IReportingPeriodHistory } from '@domain/accounting/types/reporting-period-audit.types';
import { IReportingPeriod } from '@domain/accounting/types/reporting-period.types';

import { reportingPeriodHistoryInAudit } from '@infra/config/drizzle/schema';
import { toRepoDate } from '@infra/persistence/helpers/date.mapper';

export interface IReportingPeriodHistoryRepoModel extends InferSelectModel<
  typeof reportingPeriodHistoryInAudit
> {}

const reportingPeriodHistoryMapper = {
  toRepo(
    reportingPeriod: IReportingPeriod,
    history: IReportingPeriodHistory
  ): Omit<IReportingPeriodHistoryRepoModel, 'id' | 'recordedAt'> {
    return {
      reportingPeriodId: history.entityId,
      accountingEntityId: reportingPeriod.accountingEntityId,
      action: history.action,
      actorId: history.actorId,
      onBehalfOf: history.onBehalfOf,
      diff: history.diff,
      correlationId: history.correlationId,
      occurredAt: toRepoDate(history.occurredAt),
    };
  },
};

export default reportingPeriodHistoryMapper;
