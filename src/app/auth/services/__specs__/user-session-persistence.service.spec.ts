import mockRepoService from '@shared/contracts/__mocks__/repo.mock';
import { ITransactionContext } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import mockUserSessionRepo from '@app/auth/contracts/__mocks__/user-session.repo.mock';
import { IUserSession } from '@app/auth/contracts/auth.types';
import makeUserSessionPersistenceAppService from '@app/auth/services/user-session-persistence.service';

describe('userSessionPersistenceAppService', () => {
  const userId = '123e4567-e89b-42d3-a456-426614174000' as TEntityId;
  const priorUserId = '123e4567-e89b-42d3-a456-426614174001' as TEntityId;
  const tx = 'mock-tx' as unknown as ITransactionContext;
  const userSession: IUserSession = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: '123e4567-e89b-42d3-a456-426614174002' as TEntityId,
    userId,
    refreshToken: 'new-refresh-token',
    lastLoginAt: new Date('2026-04-01T00:00:00.000Z'),
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
  };
  const repoOptions = { correlationId: 'test-correlation-id' };

  const getService = () =>
    makeUserSessionPersistenceAppService({
      userSessionRepo: mockUserSessionRepo,
      repoService: mockRepoService,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepoService.runInTransaction.mockImplementation(async (transactionFn) =>
      transactionFn(tx)
    );
    mockUserSessionRepo.delete.mockReset().mockResolvedValue(true);
    mockUserSessionRepo.create.mockReset().mockResolvedValue();
    mockUserSessionRepo.deleteAllByUserId.mockReset().mockResolvedValue();
  });

  it('replaces an optional prior client session and cleans a generated-token collision', async () => {
    await getService().replaceClientSession(
      {
        userSession,
        priorClientSession: {
          userId: priorUserId,
          refreshToken: 'prior-refresh-token',
        },
      },
      repoOptions
    );

    expect(mockUserSessionRepo.delete).toHaveBeenNthCalledWith(
      1,
      priorUserId,
      'prior-refresh-token',
      { ...repoOptions, tx }
    );
    expect(mockUserSessionRepo.delete).toHaveBeenNthCalledWith(
      2,
      userId,
      userSession.refreshToken,
      { ...repoOptions, tx }
    );
    expect(mockUserSessionRepo.create).toHaveBeenCalledWith(userSession, {
      ...repoOptions,
      tx,
    });
    expect(mockRepoService.runInTransaction).toHaveBeenCalledWith(
      expect.any(Function),
      undefined
    );
  });

  it('joins a supplied transaction for client replacement', async () => {
    const outerTx = 'outer-tx' as unknown as ITransactionContext;

    await getService().replaceClientSession(
      { userSession, priorClientSession: null },
      { ...repoOptions, tx: outerTx }
    );

    expect(mockRepoService.runInTransaction).toHaveBeenCalledWith(
      expect.any(Function),
      outerTx
    );
  });

  it('rotates a consumed presented session before creating its replacement', async () => {
    const rotated = await getService().rotateSession(
      {
        userSession,
        presentedSession: {
          userId,
          refreshToken: 'presented-refresh-token',
        },
      },
      repoOptions
    );

    expect(rotated).toBe(true);
    expect(mockUserSessionRepo.delete).toHaveBeenNthCalledWith(
      1,
      userId,
      'presented-refresh-token',
      { ...repoOptions, tx }
    );
    expect(mockUserSessionRepo.delete.mock.invocationCallOrder[0]).toBeLessThan(
      mockUserSessionRepo.create.mock.invocationCallOrder[0]
    );
  });

  it('does not clean collisions or create when the presented session is absent', async () => {
    mockUserSessionRepo.delete.mockResolvedValueOnce(false);

    const rotated = await getService().rotateSession(
      {
        userSession,
        presentedSession: {
          userId,
          refreshToken: 'missing-refresh-token',
        },
      },
      repoOptions
    );

    expect(rotated).toBe(false);
    expect(mockUserSessionRepo.delete).toHaveBeenCalledTimes(1);
    expect(mockUserSessionRepo.create).not.toHaveBeenCalled();
  });

  it('propagates replacement creation failures after consuming the presented session', async () => {
    mockUserSessionRepo.create.mockRejectedValue(new Error('create failed'));

    await expect(
      getService().rotateSession(
        {
          userSession,
          presentedSession: {
            userId,
            refreshToken: 'presented-refresh-token',
          },
        },
        repoOptions
      )
    ).rejects.toThrow('create failed');
  });

  it('revokes all user sessions before creating the prepared replacement', async () => {
    await getService().replaceAllUserSessions(userSession, repoOptions);

    expect(mockUserSessionRepo.deleteAllByUserId).toHaveBeenCalledWith(userId, {
      ...repoOptions,
      tx,
    });
    expect(
      mockUserSessionRepo.deleteAllByUserId.mock.invocationCallOrder[0]
    ).toBeLessThan(mockUserSessionRepo.create.mock.invocationCallOrder[0]);
    expect(mockUserSessionRepo.create).toHaveBeenCalledWith(userSession, {
      ...repoOptions,
      tx,
    });
  });
});
