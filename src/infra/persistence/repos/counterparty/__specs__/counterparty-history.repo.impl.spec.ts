import { TEntityId } from '@shared/types/uuid';

import { ICounterpartyHistory } from '@domain/counterparty/types/counterparty-audit.types';
import { ICounterparty } from '@domain/counterparty/types/counterparty.types';

import getDbQuery from '@infra/persistence/helpers/get-db-query';
import counterpartyHistoryRepo from '@infra/persistence/repos/counterparty/counterparty-history.repo.impl';
import counterpartyHistoryMapper from '@infra/persistence/repos/counterparty/mappers/counterparty-history.mapper';

jest.mock('../../../helpers/get-db-query');
jest.mock('../mappers/counterparty-history.mapper');

describe('CounterpartyHistoryRepoImpl', () => {
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('inserts mapped history record', async () => {
    const values = jest.fn().mockResolvedValue(undefined);
    const db = {
      insert: jest.fn().mockReturnValue({ values }),
    };
    (getDbQuery as jest.Mock).mockReturnValue(db);
    const mappedValue = { counterpartyId: counterparty.id };
    (counterpartyHistoryMapper.toRepo as jest.Mock).mockReturnValue(
      mappedValue
    );

    await counterpartyHistoryRepo.save(counterparty, history, {
      correlationId: 'test-correlation-id',
    });

    expect(counterpartyHistoryMapper.toRepo).toHaveBeenCalledWith(
      counterparty,
      history
    );
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledWith(mappedValue);
  });
});
