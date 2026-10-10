import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService from '@shared/contracts/__mocks__/repo.mock';
import { ITransactionContext } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import makeUserIdentityService from '@domain/user/services/user-identity.service';
import { IUser } from '@domain/user/types/user.types';
import emailValue from '@domain/user/values/email.vo';

import mockUserAuthRepo from '@app/auth/contracts/__mocks__/user-auth.repo.mock';
import mockUserAuthAppService from '@app/auth/contracts/__mocks__/user-auth.service.mock';
import { EAuthStrategy, IUserAuth } from '@app/auth/contracts/auth.types';
import { IOAuthProfile } from '@app/auth/dtos/auth/auth.dto';
import makeLoginWithGoogleUseCase from '@app/auth/usecases/login-with-google.usecase';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/contracts/app-context.contract';
import {
  mockActorService,
  mockUserIdentityService,
} from '@app/user/contracts/__mocks__/actor.services.mock';
import {
  mockActorRepo,
  mockUserRepo,
} from '@app/user/contracts/__mocks__/user.repos.mock';

describe('makeLoginWithGoogleUseCase', () => {
  const correlationId = '854e4567-e89b-42d3-a456-426614174001';
  const idempotencyKey = 'test-idemp-key';

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserIdentityService.create
      .mockReset()
      .mockImplementation(makeUserIdentityService().create);
    mockActorRepo.create.mockReset().mockResolvedValue(undefined);
    mockActorService.resolveUser.mockReset();
    mockRepoService.runInTransaction
      .mockReset()
      .mockImplementation(async (transactionFn) =>
        transactionFn('mock-tx' as unknown as ITransactionContext)
      );
    mockAppContext.get.mockReturnValue({
      correlationId,
      idempotencyKey,
    } as unknown as IAppContextData);
    mockUserAuthAppService.addStrategy.mockImplementation(
      (userAuth, strategy) => ({
        ...userAuth,
        strategy: [...userAuth.strategy, strategy],
        version: userAuth.version + 1,
        updatedAt: new Date(),
      })
    );
    mockUserAuthAppService.make.mockImplementation((payload) => {
      const timestamp = new Date();

      return {
        createdBy: payload.createdBy,
        userId: payload.userId,
        password: payload.password,
        failedLoginAttempts: 0,
        strategy: [payload.strategy],
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
    });
  });

  const validProfile: IOAuthProfile = {
    providerSubject: 'google-user-123',
    email: 'testuser@example.com',
    emailVerified: true,
    firstName: 'Test',
    lastName: 'User',
  };

  const getMockUser = () =>
    ({
      id: 'existing-user-id',
      email: emailValue.make(validProfile.email),
    }) as unknown as IUser;

  const getMockUserAuth = (overrides = {}) =>
    ({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      userId: 'existing-user-id',
      password: 'hashed-password',
      failedLoginAttempts: 0,
      strategy: [EAuthStrategy.Email],
      version: 1,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      ...overrides,
    }) as unknown as IUserAuth;

  const getUseCase = () =>
    makeLoginWithGoogleUseCase({
      actorService: mockActorService,
      actorRepo: mockActorRepo,
      userIdentityService: mockUserIdentityService,
      eventBus: mockEventBus,
      appContext: mockAppContext,
      userRepo: mockUserRepo,
      userAuthRepo: mockUserAuthRepo,
      userAuthAppService: mockUserAuthAppService,
      repoService: mockRepoService,
    });

  it('should return error if profile lacks an email address', async () => {
    const useCase = getUseCase();
    const doneCallback = jest.fn();

    const invalidProfile = {
      firstName: 'Test',
      lastName: 'User',
    } as unknown as IOAuthProfile;

    await useCase(invalidProfile, doneCallback);

    expect(doneCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'app_error_request_invalid',
      }),
      false
    );
    expect(mockUserRepo.findByEmail).not.toHaveBeenCalled();
  });

  it('should sync existing user and append Google strategy if it was missing', async () => {
    const mockUser = getMockUser();
    const mockUserAuth = getMockUserAuth({ strategy: [EAuthStrategy.Email] }); // doesn't have Google

    mockUserRepo.findByEmail.mockResolvedValue(mockUser);
    mockUserAuthRepo.findByUserId.mockResolvedValue(mockUserAuth);

    const useCase = getUseCase();
    const doneCallback = jest.fn();

    await useCase(validProfile, doneCallback);

    expect(mockUserRepo.findByEmail).toHaveBeenCalledWith(
      emailValue.normalize(validProfile.email),
      { correlationId }
    );
    expect(mockUserAuthRepo.findByUserId).toHaveBeenCalledWith(mockUser.id, {
      correlationId,
      tx: 'mock-tx',
    });
    expect(mockUserAuthAppService.addStrategy).toHaveBeenCalledWith(
      mockUserAuth,
      EAuthStrategy.Google
    );

    expect(mockUserAuth.strategy).toEqual([EAuthStrategy.Email]);
    expect(mockUserAuthRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        strategy: [EAuthStrategy.Email, EAuthStrategy.Google],
        version: 2,
      }),
      { correlationId, expectedVersion: 1, tx: 'mock-tx' }
    );

    expect(doneCallback).toHaveBeenCalledWith(null, mockUser);
    expect(mockRepoService.runInTransaction).toHaveBeenCalledTimes(1);
  });

  it('should simply return existing user if Google strategy is already present', async () => {
    const mockUser = getMockUser();
    const mockUserAuth = getMockUserAuth({
      strategy: [EAuthStrategy.Email, EAuthStrategy.Google],
    });

    mockUserRepo.findByEmail.mockResolvedValue(mockUser);
    mockUserAuthRepo.findByUserId.mockResolvedValue(mockUserAuth);

    const useCase = getUseCase();
    const doneCallback = jest.fn();

    await useCase(validProfile, doneCallback);

    expect(mockUserAuthRepo.update).not.toHaveBeenCalled();
    expect(mockRepoService.runInTransaction).toHaveBeenCalledTimes(1);
    expect(doneCallback).toHaveBeenCalledWith(null, mockUser);
  });

  it('should reject an unverified email before looking up a user', async () => {
    const doneCallback = jest.fn();

    await getUseCase()({ ...validProfile, emailVerified: false }, doneCallback);

    expect(doneCallback).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'app_error_request_invalid' }),
      false
    );
    expect(mockUserRepo.findByEmail).not.toHaveBeenCalled();
  });

  it('should reject a missing provider subject before looking up a user', async () => {
    const doneCallback = jest.fn();

    await getUseCase()({ ...validProfile, providerSubject: '' }, doneCallback);

    expect(doneCallback).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'app_error_request_invalid' }),
      false
    );
    expect(mockUserRepo.findByEmail).not.toHaveBeenCalled();
  });

  it('should fail closed when an existing user has no auth record', async () => {
    const mockUser = getMockUser();
    mockUserRepo.findByEmail.mockResolvedValue(mockUser);
    mockUserAuthRepo.findByUserId.mockResolvedValue(null);
    const doneCallback = jest.fn();

    await getUseCase()(validProfile, doneCallback);

    expect(doneCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'auth_error_inconsistent_user_auth_unexpected',
      }),
      false
    );
    expect(mockUserAuthRepo.update).not.toHaveBeenCalled();
  });

  it('should create new user/userAuth in transaction if user does not exist', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(null); // No user found

    const useCase = getUseCase();
    const doneCallback = jest.fn();

    await useCase(validProfile, doneCallback);

    expect(mockRepoService.runInTransaction).toHaveBeenCalled();
    expect(mockUserRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: validProfile.firstName,
        lastName: validProfile.lastName,
        email: 'testuser@example.com',
        emailVerified: true,
      }),
      expect.objectContaining({
        correlationId,
        tx: 'mock-tx',
        history: expect.any(Object),
      })
    );

    expect(mockUserAuthRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: expect.any(String),
        password: null,
        failedLoginAttempts: 0,
        strategy: [EAuthStrategy.Google],
        version: 1,
      }),
      expect.objectContaining({ correlationId, tx: 'mock-tx' })
    );

    expect(mockEventBus.publish).toHaveBeenCalled();

    expect(doneCallback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        firstName: validProfile.firstName,
      })
    );
  });

  it('should fail the callback when user event publication rejects', async () => {
    const publicationError = new Error('Event publication failed');
    mockUserRepo.findByEmail.mockResolvedValue(null);
    mockEventBus.publish.mockRejectedValue(publicationError);
    const doneCallback = jest.fn();

    await getUseCase()(validProfile, doneCallback);

    expect(doneCallback).toHaveBeenCalledWith(publicationError, false);
    expect(doneCallback).not.toHaveBeenCalledWith(null, expect.anything());
  });

  it('should catch and return systematic errors gracefully to done callback', async () => {
    mockUserRepo.findByEmail.mockRejectedValue(new Error('Database explosion'));

    const useCase = getUseCase();
    const doneCallback = jest.fn();

    await useCase(validProfile, doneCallback);

    expect(doneCallback).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Database explosion' }),
      false
    );
  });

  it('should catch non-Error exceptions and map to ErrorInternalServerError', async () => {
    mockUserRepo.findByEmail.mockRejectedValue('String error');

    const useCase = getUseCase();
    const doneCallback = jest.fn();

    await useCase(validProfile, doneCallback);

    expect(doneCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'app_error_unexpected',
      }),
      false
    );
  });
});
