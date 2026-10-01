import { TEntityId } from '@shared/types/uuid';

import { ICounterpartyHistory } from '@domain/counterparty/types/counterparty-audit.types';
import { ICounterparty } from '@domain/counterparty/types/counterparty.types';

import counterpartyHistoryMapper from '@infra/persistence/repos/counterparty/mappers/counterparty-history.mapper';

describe('counterpartyHistoryMapper', () => {
  const now = new Date('2026-08-01T00:00:00.000Z');
  const counterparty: ICounterparty = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: '123e4567-e89b-12d3-a456-426614174001' as TEntityId,
    accountingEntityId: '123e4567-e89b-12d3-a456-426614174002' as TEntityId,
    name: 'Acme Corp',
    status: 'active',
    type: 'organization',
    meta: {},
    roles: [],
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  const history: ICounterpartyHistory = {
    onBehalfOf: null,
    entityId: counterparty.id,
    entityVersion: 1,
    action: 'created',
    actorId: '123e4567-e89b-12d3-a456-426614174003' as TEntityId,
    diff: {
      before: null,
      after: counterparty,
    },
    correlationId: 'test-correlation-id',
    occurredAt: now,
  };

  it('maps counterparty and history to repo history model', () => {
    const result = counterpartyHistoryMapper.toRepo(counterparty, history);

    expect(result).toEqual({
      entityVersion: history.entityVersion,
      counterpartyId: counterparty.id,
      accountingEntityId: counterparty.accountingEntityId,
      actorId: '123e4567-e89b-12d3-a456-426614174003',
      onBehalfOf: null,
      action: 'created',
      diff: history.diff,
      correlationId: 'test-correlation-id',
      occurredAt: now.toISOString(),
    });
  });
});
