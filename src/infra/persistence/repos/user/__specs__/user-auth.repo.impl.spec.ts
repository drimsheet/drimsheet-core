import { eq } from 'drizzle-orm';

import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';
import repoError from '@shared/values/errors/repo.error';

import { IUserAuth } from '@app/auth/contracts/auth.types';

import { userAuthInCore } from '@infra/config/drizzle/schema';
import getDbQueryHelper from '@infra/persistence/helpers/get-db-query.helper';
import userAuthMapper from '@infra/persistence/repos/auth/mappers/user-auth.mapper';
import userAuthRepo from '@infra/persistence/repos/user/user-auth.repo.impl';

jest.mock('@infra/persistence/helpers/get-db-query.helper');
jest.mock('../../auth/mappers/user-auth.mapper');
jest.mock('drizzle-orm', () => {
  const drizzle =
    jest.requireActual<typeof import('drizzle-orm')>('drizzle-orm');

  return { ...drizzle, eq: jest.fn(drizzle.eq) };
});

describe('userAuthRepo strict updates', () => {
  const userAuth = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    userId: generateUUID(),
    version: 2,
  } as IUserAuth;
  const repoModel = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    userId: userAuth.userId,
    version: userAuth.version,
  } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(userAuthMapper.toRepo).mockReturnValue(repoModel);
  });

  function mockUpdate(rowCount: number) {
    const where = jest.fn().mockResolvedValue({ rowCount });
    const set = jest.fn().mockReturnValue({ where });
    const update = jest.fn().mockReturnValue({ set });
    jest
      .mocked(getDbQueryHelper)
      .mockReturnValue({ update } as unknown as ReturnType<
        typeof getDbQueryHelper
      >);

    return set;
  }

  it('persists the supplied entity and predicates the update on expectedVersion', async () => {
    const set = mockUpdate(1);

    await userAuthRepo.update(userAuth, {
      correlationId: 'correlation-id',
      expectedVersion: 1,
    });

    expect(set).toHaveBeenCalledWith(repoModel);
    expect(eq).toHaveBeenCalledWith(userAuthInCore.version, 1);
  });

  it('throws the repository version conflict for a stale write', async () => {
    mockUpdate(0);

    await expect(
      userAuthRepo.update(userAuth, {
        correlationId: 'correlation-id',
        expectedVersion: 1,
      })
    ).rejects.toBeInstanceOf(repoError.VersionNotFound);
  });

  it('rejects an incorrect next entity version before querying', async () => {
    await expect(
      userAuthRepo.update(userAuth, {
        correlationId: 'correlation-id',
        expectedVersion: 2,
      })
    ).rejects.toBeInstanceOf(repoError.VersionMismatch);

    expect(getDbQueryHelper).not.toHaveBeenCalled();
  });
});
