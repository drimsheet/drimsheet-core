import { InferSelectModel } from 'drizzle-orm';

import { IAccountingPeriodHistory } from '@domain/accounting/types/accounting-period-audit.types';
import { IAccountingPeriod } from '@domain/accounting/types/accounting-period.types';

import { accountingPeriodHistoryInAudit } from '@infra/config/drizzle/schema';
import { toRepoDate } from '@infra/persistence/helpers/date.mapper';

export interface IAccountingPeriodHistoryRepoModel extends InferSelectModel<
  typeof accountingPeriodHistoryInAudit
> {}

const accountingPeriodHistoryMapper = {
  toRepo(
    period: IAccountingPeriod,
    history: IAccountingPeriodHistory
  ): Omit<IAccountingPeriodHistoryRepoModel, 'id' | 'recordedAt'> {
    return {
      accountingPeriodId: history.entityId,
      accountingEntityId: period.accountingEntityId,
      action: history.action,
      actorId: history.actorId,
      onBehalfOf: history.onBehalfOf,
      diff: history.diff,
      correlationId: history.correlationId,
      occurredAt: toRepoDate(history.occurredAt),
    };
  },
};

export default accountingPeriodHistoryMapper;
