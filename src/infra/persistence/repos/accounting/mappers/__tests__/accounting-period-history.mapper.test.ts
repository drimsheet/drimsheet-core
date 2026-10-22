import { TEntityId } from '@shared/types/uuid';

import { IAccountingPeriodHistory } from '@domain/accounting/types/accounting-period-audit.types';
import { IAccountingPeriod } from '@domain/accounting/types/accounting-period.types';

import { toRepoDate } from '@infra/persistence/helpers/date.mapper';
import accountingPeriodHistoryMapper from '@infra/persistence/repos/accounting/mappers/accounting-period-history.mapper';

describe('accountingPeriodHistoryMapper', () => {
  it('maps accounting period history to the repository model', () => {
    const accountingPeriodId = 'accounting-period-uuid' as TEntityId;
    const accountingEntityId = 'accounting-entity-uuid' as TEntityId;
    const userId = 'user-uuid' as TEntityId;
    const occurredAt = new Date('2026-07-25T12:00:00.000Z');

    const period: IAccountingPeriod = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      accountingEntityId,
    } as IAccountingPeriod;

    const history: IAccountingPeriodHistory = {
      entityId: accountingPeriodId,
      entityVersion: 1,
      action: 'created',
      diff: {
        before: null,
        after: period,
      },
      occurredAt,
      actorId: userId,
      onBehalfOf: null,
      correlationId: 'correlation-id-jkl',
    };

    expect(accountingPeriodHistoryMapper.toRepo(period, history)).toEqual({
      accountingPeriodId,
      accountingEntityId,
      actorId: userId,
      onBehalfOf: null,
      action: 'created',
      diff: history.diff,
      correlationId: 'correlation-id-jkl',
      occurredAt: toRepoDate(occurredAt),
    });
  });
});
