import { eq } from 'drizzle-orm';

import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';
import repoError from '@shared/values/errors/repo.error';

import { IUser } from '@domain/user/types/user.types';

import { usersInCore } from '@infra/config/drizzle/schema';
import getDbQueryHelper from '@infra/persistence/helpers/get-db-query.helper';
import userMapper from '@infra/persistence/repos/user/mappers/user.mapper';
import userHistoryRepo from '@infra/persistence/repos/user/user-history.repo.impl';
import userRepo from '@infra/persistence/repos/user/user.repo.impl';

jest.mock('@infra/persistence/helpers/get-db-query.helper');
jest.mock('../mappers/user.mapper');
jest.mock('../user-history.repo.impl');
jest.mock('drizzle-orm', () => {
  const drizzle =
    jest.requireActual<typeof import('drizzle-orm')>('drizzle-orm');

  return { ...drizzle, eq: jest.fn(drizzle.eq) };
});

describe('userRepo strict updates', () => {
  const user = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: generateUUID(),
    version: 2,
  } as IUser;
  const history = { entityId: user.id, entityVersion: 2 } as never;
  const repoModel = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: user.id,
    version: user.version,
  } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(userMapper.toRepo).mockReturnValue(repoModel);
  });

  function mockUpdate(rowCount: number) {
    const where = jest.fn().mockResolvedValue({ rowCount });
    const set = jest.fn().mockReturnValue({ where });
    const update = jest.fn().mockReturnValue({ set });
    const tx = { update };
    jest.mocked(getDbQueryHelper).mockReturnValue({
      transaction: jest.fn(async (callback) => callback(tx as never)),
    } as unknown as ReturnType<typeof getDbQueryHelper>);

    return { set, where };
  }

  it('persists the entity version and predicates the update on expectedVersion', async () => {
    const query = mockUpdate(1);

    await userRepo.update(user, {
      correlationId: 'correlation-id',
      expectedVersion: 1,
      history,
    });

    expect(query.set).toHaveBeenCalledWith(repoModel);
    expect(eq).toHaveBeenCalledWith(usersInCore.version, 1);
    expect(userHistoryRepo.save).toHaveBeenCalledWith(
      history,
      expect.objectContaining({ tx: expect.anything() })
    );
  });

  it('throws a version conflict and does not persist history for a stale write', async () => {
    mockUpdate(0);

    await expect(
      userRepo.update(user, {
        correlationId: 'correlation-id',
        expectedVersion: 1,
        history,
      })
    ).rejects.toBeInstanceOf(repoError.VersionNotFound);

    expect(userHistoryRepo.save).not.toHaveBeenCalled();
  });

  it('rejects a history-version mismatch before opening a transaction', async () => {
    await expect(
      userRepo.update(user, {
        correlationId: 'correlation-id',
        expectedVersion: 1,
        history: {
          actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
          onBehalfOf: null,
          entityId: user.id,
          entityVersion: 3,
        } as never,
      })
    ).rejects.toBeInstanceOf(repoError.VersionMismatch);

    expect(getDbQueryHelper).not.toHaveBeenCalled();
  });
});
