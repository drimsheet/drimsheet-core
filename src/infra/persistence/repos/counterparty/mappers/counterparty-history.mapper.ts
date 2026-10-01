import { InferSelectModel } from 'drizzle-orm';

import { ICounterpartyHistory } from '@domain/counterparty/types/counterparty-audit.types';
import { ICounterparty } from '@domain/counterparty/types/counterparty.types';

import { counterpartyHistoryInAudit } from '@infra/config/drizzle/schema';
import { toRepoDate } from '@infra/persistence/helpers/date.mapper';

export interface ICounterpartyHistoryRepoModel extends InferSelectModel<
  typeof counterpartyHistoryInAudit
> {}

const counterpartyHistoryMapper = {
  toRepo(
    counterparty: ICounterparty,
    history: ICounterpartyHistory
  ): Omit<ICounterpartyHistoryRepoModel, 'id' | 'recordedAt'> {
    return {
      counterpartyId: history.entityId,
      entityVersion: history.entityVersion,
      accountingEntityId: counterparty.accountingEntityId,
      action: history.action,
      actorId: history.actorId,
      onBehalfOf: history.onBehalfOf,
      diff: history.diff,
      correlationId: history.correlationId,
      occurredAt: toRepoDate(history.occurredAt),
    };
  },
};

export default counterpartyHistoryMapper;
