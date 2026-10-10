import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService from '@shared/contracts/__mocks__/repo.mock';
import mockReporter from '@shared/contracts/__mocks__/reporter.mock';
import { ITransactionContext } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';
import appError from '@shared/values/errors/app.error';
import { IEvent } from '@shared/values/events/types/event.types';

import { IUser } from '@domain/user/types/user.types';
import emailValue from '@domain/user/values/email.vo';

import mockPasswordAppService from '@app/auth/contracts/__mocks__/password-service.mock';
import mockTokenAppService from '@app/auth/contracts/__mocks__/token-service.mock';
import mockUserAuthRepo from '@app/auth/contracts/__mocks__/user-auth.repo.mock';
import mockUserAuthAppService from '@app/auth/contracts/__mocks__/user-auth.service.mock';
import mockUserSessionPersistenceAppService from '@app/auth/contracts/__mocks__/user-session-persistence.service.mock';
import mockUserSessionAppService from '@app/auth/contracts/__mocks__/user-session.service.mock';
import { EAuthStrategy, IUserAuth } from '@app/auth/contracts/auth.types';
import authError from '@app/auth/errors/auth.error';
import makeResetPasswordUseCase from '@app/auth/usecases/reset-password.usecase';
import mockAppContext, {
  mockClientSession,
} from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/contracts/app-context.contract';
import { mockActorService } from '@app/user/contracts/__mocks__/actor.services.mock';
import { mockUserRepo } from '@app/user/contracts/__mocks__/user.repos.mock';

describe('makeResetPasswordUseCase', () => {
  const correlationId = 'test-corr-id';
  const idempotencyKey = 'idempotency-key';

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepoService.runInTransaction
      .mockReset()
      .mockImplementation(async (transactionFn) =>
        transactionFn('mock-tx' as unknown as ITransactionContext)
      );
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2023-01-01T00:00:00.000Z'));
    mockAppContext.get.mockReturnValue({
      correlationId,
      idempotencyKey,
      clientSession: mockClientSession,
    } as unknown as IAppContextData);
    mockPasswordAppService.makePassword
      .mockReset()
      .mockImplementation((input) => input as string);
    mockUserAuthAppService.replacePassword
      .mockReset()
      .mockImplementation((userAuth, password) => ({
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        userId: userAuth.userId,
        password,
        failedLoginAttempts: 0,
        strategy: userAuth.strategy.includes(EAuthStrategy.Email)
          ? userAuth.strategy
          : [...userAuth.strategy, EAuthStrategy.Email],
        version: userAuth.version + 1,
        createdAt: userAuth.createdAt,
        updatedAt: new Date(),
      }));
    mockUserSessionAppService.prepare
      .mockReset()
      .mockImplementation(async (user) => ({
        accessToken: 'mock-auth-token',
        refreshToken: 'mock-refresh-token',
        userSession: {
          createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
          id: generateUUID(),
          userId: user.id,
          refreshToken: 'mock-refresh-token',
          lastLoginAt: new Date(),
          createdAt: new Date(),
        },
        priorClientSession: null,
      }));
    mockUserSessionPersistenceAppService.replaceAllUserSessions
      .mockReset()
      .mockResolvedValue();
    mockTokenAppService.releasePasswordResetTokenClaim
      .mockReset()
      .mockResolvedValue();
    mockTokenAppService.finalizePasswordResetToken
      .mockReset()
      .mockResolvedValue();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const getValidPayload = () => ({
    token: 'valid-reset-token',
    password: 'Password123!',
    confirmPassword: 'Password123!',
  });

  const getUseCase = () =>
    makeResetPasswordUseCase({
      actorService: mockActorService,
      appContext: mockAppContext,
      userRepo: mockUserRepo,
      passwordAppService: mockPasswordAppService,
      tokenAppService: mockTokenAppService,
      eventBus: mockEventBus,
      userAuthRepo: mockUserAuthRepo,
      userAuthAppService: mockUserAuthAppService,
      userSessionAppService: mockUserSessionAppService,
      userSessionPersistenceAppService: mockUserSessionPersistenceAppService,
      repoService: mockRepoService,
      reporter: mockReporter,
    });

  it('should explicitly fail validation if passwords do not match', async () => {
    const usecase = getUseCase();

    const payload = getValidPayload();
    payload.confirmPassword = 'DifferentPassword1!';

    await expect(usecase(payload)).rejects.toThrow(
      appError.UnprocessableEntity
    );
  });

  it('should propagate AuthError if the reset token is invalid or expired', async () => {
    mockTokenAppService.claimPasswordResetToken.mockRejectedValue(
      new authError.InvalidToken()
    );

    const usecase = getUseCase();
    const payload = getValidPayload();

    await expect(usecase(payload)).rejects.toThrow(authError.Base);
  });

  it('should throw an error if user cannot be found in DB', async () => {
    mockTokenAppService.claimPasswordResetToken.mockResolvedValue({
      id: 'internal-id' as TEntityId,
      owner: 'claim-owner',
    });
    mockUserRepo.findById.mockResolvedValue(null);

    const usecase = getUseCase();
    const payload = getValidPayload();

    await expect(usecase(payload)).rejects.toThrow(authError.InvalidToken);
    expect(
      mockTokenAppService.releasePasswordResetTokenClaim
    ).toHaveBeenCalledWith({
      id: 'internal-id',
      owner: 'claim-owner',
    });
  });

  it('should throw an error if the user auth record cannot be found in DB', async () => {
    mockTokenAppService.claimPasswordResetToken.mockResolvedValue({
      id: 'internal-id' as TEntityId,
      owner: 'claim-owner',
    });
    mockUserRepo.findById.mockResolvedValue({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: 'internal-id',
    } as IUser);
    mockUserAuthRepo.findByUserId.mockResolvedValue(null);

    const usecase = getUseCase();
    const payload = getValidPayload();

    await expect(usecase(payload)).rejects.toThrow(authError.InvalidToken);
  });

  it('should successfully update the password and broadcast the event', async () => {
    const mockUser: IUser = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: generateUUID(),
      email: emailValue.make('found@example.com'),
      emailVerified: true,
      firstName: 'John',
      lastName: 'Doe',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    mockTokenAppService.claimPasswordResetToken.mockResolvedValue({
      id: mockUser.id,
      owner: 'claim-owner',
    });
    mockUserRepo.findById.mockResolvedValue(mockUser);
    const existingUserAuth = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      userId: mockUser.id,
      password: 'old-hash',
      failedLoginAttempts: 0,
      strategy: ['email'],
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as IUserAuth;
    mockUserAuthRepo.findByUserId.mockResolvedValue(existingUserAuth);
    mockPasswordAppService.hash.mockResolvedValue('new-hash');

    const usecase = getUseCase();

    const payload = getValidPayload();
    const result = await usecase(payload);

    expect(mockTokenAppService.claimPasswordResetToken).toHaveBeenCalledWith(
      payload.token
    );
    expect(mockUserRepo.findById).toHaveBeenCalledWith(mockUser.id, {
      correlationId,
    });
    expect(mockPasswordAppService.makePassword).toHaveBeenCalledWith(
      payload.password
    );
    expect(mockPasswordAppService.hash).toHaveBeenCalledWith(payload.password);
    expect(mockUserSessionAppService.prepare).toHaveBeenCalledWith(mockUser);

    expect(mockRepoService.runInTransaction).toHaveBeenCalled();
    expect(mockUserAuthRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        password: 'new-hash',
        failedLoginAttempts: 0,
        strategy: ['email'],
        version: 2,
      }),
      { correlationId, expectedVersion: 1, tx: 'mock-tx' }
    );
    expect(
      mockUserSessionPersistenceAppService.replaceAllUserSessions
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: mockUser.id,
        refreshToken: 'mock-refresh-token',
      }),
      { correlationId, tx: 'mock-tx' }
    );
    expect(mockTokenAppService.finalizePasswordResetToken).toHaveBeenCalledWith(
      {
        id: mockUser.id,
        owner: 'claim-owner',
      }
    );
    expect(mockEventBus.publish).toHaveBeenCalled();
    expect(mockClientSession.setRefreshToken).toHaveBeenCalledWith(
      'mock-refresh-token'
    );

    const publishedArgs = (mockEventBus.publish as jest.Mock).mock
      .calls[0] as IEvent<IUser>[];
    expect(publishedArgs[0].correlationId).toBe(correlationId);
    expect(publishedArgs[0].idempotencyKey).toBe(idempotencyKey);

    expect(result).toEqual({
      accessToken: 'mock-auth-token',
    });
  });

  it('adds the email strategy when a Google-only user creates a password', async () => {
    const mockUser: IUser = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: generateUUID(),
      email: emailValue.make('google-user@example.com'),
      emailVerified: true,
      firstName: 'Grace',
      lastName: 'Hopper',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    const existingUserAuth = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      userId: mockUser.id,
      password: null,
      failedLoginAttempts: 0,
      strategy: ['google'],
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as IUserAuth;

    mockTokenAppService.claimPasswordResetToken.mockResolvedValue({
      id: mockUser.id,
      owner: 'claim-owner',
    });
    mockUserRepo.findById.mockResolvedValue(mockUser);
    mockUserAuthRepo.findByUserId.mockResolvedValue(existingUserAuth);
    mockPasswordAppService.hash.mockResolvedValue('new-hash');

    await getUseCase()(getValidPayload());

    expect(mockUserAuthRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        password: 'new-hash',
        failedLoginAttempts: 0,
        strategy: ['google', 'email'],
        version: 2,
      }),
      { correlationId, expectedVersion: 1, tx: 'mock-tx' }
    );
  });

  it('returns committed success and reports token finalization failure', async () => {
    const mockUser = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: generateUUID(),
      email: emailValue.make('committed@example.com'),
      emailVerified: true,
    } as IUser;
    mockTokenAppService.claimPasswordResetToken.mockResolvedValue({
      id: mockUser.id,
      owner: 'claim-owner',
    });
    mockUserRepo.findById.mockResolvedValue(mockUser);
    mockUserAuthRepo.findByUserId.mockResolvedValue({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      userId: mockUser.id,
      password: 'old-hash',
      failedLoginAttempts: 0,
      strategy: [EAuthStrategy.Email],
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as IUserAuth);
    mockPasswordAppService.hash.mockResolvedValue('new-hash');
    mockUserSessionAppService.prepare.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      userSession: {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id: generateUUID(),
        userId: mockUser.id,
        refreshToken: 'refresh-token',
        lastLoginAt: new Date(),
        createdAt: new Date(),
      },
      priorClientSession: null,
    });
    const failure = new Error('cache unavailable');
    mockTokenAppService.finalizePasswordResetToken.mockRejectedValue(failure);

    await expect(getUseCase()(getValidPayload())).resolves.toEqual({
      accessToken: 'access-token',
    });
    expect(mockReporter.report).toHaveBeenCalledWith(
      'auth.password_reset.finalization_failed',
      failure,
      {
        operation: 'finalize-password-reset-token',
      }
    );
    expect(
      mockTokenAppService.releasePasswordResetTokenClaim
    ).not.toHaveBeenCalled();
  });

  it('reports claim release failure when cleanup fails during error handling', async () => {
    const mockUser = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: generateUUID(),
      email: emailValue.make('cleanup-failure@example.com'),
      emailVerified: true,
    } as IUser;

    const tokenPayload = {
      id: mockUser.id,
      owner: 'claim-owner',
    };

    mockTokenAppService.claimPasswordResetToken.mockResolvedValue(tokenPayload);
    const dbError = new Error('Database lookup failure');
    mockUserRepo.findById.mockRejectedValue(dbError);

    const cleanupError = new Error('Redis connection failure');
    mockTokenAppService.releasePasswordResetTokenClaim.mockRejectedValue(
      cleanupError
    );

    await expect(getUseCase()(getValidPayload())).rejects.toThrow(dbError);

    expect(mockReporter.report).toHaveBeenCalledWith(
      'auth.password_reset.claim_release_failed',
      cleanupError,
      {
        operation: 'release-password-reset-token-claim',
      }
    );
  });

  it('does not release claim if error is thrown after commit', async () => {
    const mockUser = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: generateUUID(),
      email: emailValue.make('after-commit-failure@example.com'),
      emailVerified: true,
    } as IUser;

    const tokenPayload = {
      id: mockUser.id,
      owner: 'claim-owner',
    };

    mockTokenAppService.claimPasswordResetToken.mockResolvedValue(tokenPayload);
    mockUserRepo.findById.mockResolvedValue(mockUser);
    mockUserAuthRepo.findByUserId.mockResolvedValue({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      userId: mockUser.id,
      password: 'old-hash',
      failedLoginAttempts: 0,
      strategy: [EAuthStrategy.Email],
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as IUserAuth);
    mockPasswordAppService.hash.mockResolvedValue('new-hash');
    mockUserSessionAppService.prepare.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      userSession: {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id: generateUUID(),
        userId: mockUser.id,
        refreshToken: 'refresh-token',
        lastLoginAt: new Date(),
        createdAt: new Date(),
      },
      priorClientSession: null,
    });

    // Force an error after commit
    mockClientSession.setRefreshToken.mockImplementationOnce(() => {
      throw new Error('Context error after commit');
    });

    await expect(getUseCase()(getValidPayload())).rejects.toThrow(
      'Context error after commit'
    );

    expect(
      mockTokenAppService.releasePasswordResetTokenClaim
    ).not.toHaveBeenCalled();
  });
});
