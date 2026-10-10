import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService from '@shared/contracts/__mocks__/repo.mock';
import { ITransactionContext } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import userEntity from '@domain/user/entities/user.entity';
import { IUser } from '@domain/user/types/user.types';

import mockTokenAppService from '@app/auth/contracts/__mocks__/token-service.mock';
import mockUserSessionPersistenceAppService from '@app/auth/contracts/__mocks__/user-session-persistence.service.mock';
import mockUserSessionAppService from '@app/auth/contracts/__mocks__/user-session.service.mock';
import authError from '@app/auth/errors/auth.error';
import makeVerifyEmailAddressUseCase from '@app/auth/usecases/verify-email.usecase';
import mockAppContext, {
  mockClientSession,
} from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/contracts/app-context.contract';
import { mockActorService } from '@app/user/contracts/__mocks__/actor.services.mock';
import { mockUserRepo } from '@app/user/contracts/__mocks__/user.repos.mock';

describe('makeVerifyEmailAddressUseCase', () => {
  const correlationId = '854e4567-e89b-42d3-a456-426614174001';
  const tx = 'mock-tx' as unknown as ITransactionContext;

  const getUseCase = () =>
    makeVerifyEmailAddressUseCase({
      actorService: mockActorService,
      tokenAppService: mockTokenAppService,
      userRepo: mockUserRepo,
      appContext: mockAppContext,
      eventBus: mockEventBus,
      userSessionAppService: mockUserSessionAppService,
      userSessionPersistenceAppService: mockUserSessionPersistenceAppService,
      repoService: mockRepoService,
    });

  const prepareSession = (user: IUser) => {
    const preparedSession = {
      accessToken: 'new-auth-token',
      refreshToken: 'new-refresh-token',
      userSession: {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id: '123e4567-e89b-42d3-a456-426614174003' as TEntityId,
        userId: user.id,
        refreshToken: 'new-refresh-token',
        lastLoginAt: new Date('2026-04-01T00:00:00.000Z'),
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
      },
      priorClientSession: null,
    };
    mockUserSessionAppService.prepare.mockResolvedValue(preparedSession);

    return preparedSession;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepoService.runInTransaction
      .mockReset()
      .mockImplementation(async (transactionFn) => transactionFn(tx));
    mockAppContext.get.mockReturnValue({
      correlationId,
      clientSession: mockClientSession,
    } as unknown as IAppContextData);
    mockClientSession.getRefreshToken.mockReturnValue(null);
    mockUserSessionPersistenceAppService.replaceClientSession
      .mockReset()
      .mockResolvedValue();
  });

  it('throws UnprocessableEntity for an invalid token input', async () => {
    await expect(getUseCase()(123 as unknown as string)).rejects.toThrow(
      appError.UnprocessableEntity
    );
  });

  it('verifies the user, replaces the client session in the outer transaction, and exposes credentials after commit', async () => {
    const token = 'valid-token';
    const [user] = userEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      email: 'johndoe@example.com',
      emailVerified: false,
      firstName: 'John',
      lastName: 'Doe',
    });
    const preparedSession = prepareSession(user);
    mockTokenAppService.claimSignupToken.mockResolvedValue({ id: user.id });
    mockUserRepo.findById.mockResolvedValue(user);

    const result = await getUseCase()(token);

    expect(mockUserRepo.findById).toHaveBeenCalledWith(user.id, {
      correlationId,
      tx,
    });
    expect(mockUserRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: user.id, emailVerified: true, version: 2 }),
      expect.objectContaining({
        correlationId,
        expectedVersion: user.version,
        history: expect.any(Object),
        tx,
      })
    );
    expect(mockUserSessionAppService.prepare).toHaveBeenCalledWith(
      expect.objectContaining({ id: user.id, emailVerified: true }),
      null
    );
    expect(
      mockUserSessionPersistenceAppService.replaceClientSession
    ).toHaveBeenCalledWith(
      { userSession: preparedSession.userSession, priorClientSession: null },
      { correlationId, tx }
    );
    expect(mockClientSession.setRefreshToken).toHaveBeenCalledWith(
      preparedSession.refreshToken
    );
    expect(mockEventBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({ correlationId }),
    ]);
    expect(mockTokenAppService.finalizeSignupToken).toHaveBeenCalledWith(
      user.id
    );
    expect(result).toEqual({ accessToken: preparedSession.accessToken });
  });

  it('creates a session without updating or publishing when email is already verified', async () => {
    const [user] = userEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      email: 'johndoe@example.com',
      emailVerified: true,
      firstName: 'John',
      lastName: 'Doe',
    });
    const preparedSession = prepareSession(user);
    mockTokenAppService.claimSignupToken.mockResolvedValue({ id: user.id });
    mockUserRepo.findById.mockResolvedValue(user);

    const result = await getUseCase()('valid-token');

    expect(mockUserRepo.update).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    expect(result).toEqual({ accessToken: preparedSession.accessToken });
  });

  it('does not mutate the client or publish if the outer transaction fails after session persistence', async () => {
    const [user] = userEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      email: 'johndoe@example.com',
      emailVerified: false,
      firstName: 'John',
      lastName: 'Doe',
    });
    prepareSession(user);
    mockTokenAppService.claimSignupToken.mockResolvedValue({ id: user.id });
    mockUserRepo.findById.mockResolvedValue(user);
    mockRepoService.runInTransaction.mockImplementationOnce(
      async (transactionFn) => {
        await transactionFn(tx);
        throw new Error('outer transaction failed');
      }
    );

    await expect(getUseCase()('valid-token')).rejects.toThrow(
      'outer transaction failed'
    );

    expect(
      mockUserSessionPersistenceAppService.replaceClientSession
    ).toHaveBeenCalled();
    expect(mockClientSession.setRefreshToken).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    expect(mockTokenAppService.releaseSignupTokenClaim).toHaveBeenCalledWith(
      user.id
    );
  });

  it('propagates an invalid token without starting persistence', async () => {
    mockTokenAppService.claimSignupToken.mockRejectedValue(
      new authError.InvalidToken()
    );

    await expect(getUseCase()('invalid-token')).rejects.toThrow(authError.Base);

    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('maps an absent user to InvalidToken and releases the signup-token claim', async () => {
    const userId = '123e4567-e89b-42d3-a456-426614174004' as TEntityId;
    mockTokenAppService.claimSignupToken.mockResolvedValue({ id: userId });
    mockUserRepo.findById.mockResolvedValue(null);

    await expect(getUseCase()('valid-token')).rejects.toThrow(
      authError.InvalidToken
    );

    expect(mockTokenAppService.releaseSignupTokenClaim).toHaveBeenCalledWith(
      userId
    );
    expect(mockUserSessionAppService.prepare).not.toHaveBeenCalled();
  });

  it('releases the signup-token claim and rethrows an unexpected repository error', async () => {
    const userId = '123e4567-e89b-42d3-a456-426614174005' as TEntityId;
    mockTokenAppService.claimSignupToken.mockResolvedValue({ id: userId });
    mockUserRepo.findById.mockRejectedValue(
      new Error('Database connection failed')
    );

    await expect(getUseCase()('valid-token')).rejects.toThrow(
      'Database connection failed'
    );

    expect(mockTokenAppService.releaseSignupTokenClaim).toHaveBeenCalledWith(
      userId
    );
  });
});
