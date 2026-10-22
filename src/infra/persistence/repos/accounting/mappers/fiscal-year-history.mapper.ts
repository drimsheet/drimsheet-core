import { InferSelectModel } from 'drizzle-orm';

import { IFiscalYearHistory } from '@domain/accounting/types/fiscal-year-audit.types';
import { IFiscalYear } from '@domain/accounting/types/fiscal-year.types';

import { fiscalYearHistoryInAudit } from '@infra/config/drizzle/schema';
import { toRepoDate } from '@infra/persistence/helpers/date.mapper';

export interface IFiscalYearHistoryRepoModel extends InferSelectModel<
  typeof fiscalYearHistoryInAudit
> {}

const fiscalYearHistoryMapper = {
  toRepo(
    fiscalYear: IFiscalYear,
    history: IFiscalYearHistory
  ): Omit<IFiscalYearHistoryRepoModel, 'id' | 'recordedAt'> {
    return {
      fiscalYearId: history.entityId,
      accountingEntityId: fiscalYear.accountingEntityId,
      action: history.action,
      actorId: history.actorId,
      onBehalfOf: history.onBehalfOf,
      diff: history.diff,
      correlationId: history.correlationId,
      occurredAt: toRepoDate(history.occurredAt),
    };
  },
};

export default fiscalYearHistoryMapper;
