import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService from '@shared/contracts/__mocks__/repo.mock';
import { ITransactionContext } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import makeUserIdentityService from '@domain/user/services/user-identity.service';
import { IUser } from '@domain/user/types/user.types';
import emailValue from '@domain/user/values/email.vo';

import mockEmailVerificationAppService from '@app/auth/contracts/__mocks__/email-verification.service.mock';
import mockPasswordAppService from '@app/auth/contracts/__mocks__/password-service.mock';
import mockUserAuthRepo from '@app/auth/contracts/__mocks__/user-auth.repo.mock';
import mockUserAuthAppService from '@app/auth/contracts/__mocks__/user-auth.service.mock';
import { IUserSignupReq } from '@app/auth/dtos/auth/auth.dto';
import makeSignupWithEmailUsecase from '@app/auth/usecases/signup-with-email.usecase';
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

describe('makeSignupWithEmailUsecase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserIdentityService.create
      .mockReset()
      .mockImplementation(makeUserIdentityService().create);
    mockActorRepo.create.mockReset().mockResolvedValue(undefined);
    mockActorService.resolveUser.mockReset();
    mockUserRepo.create.mockReset().mockResolvedValue(undefined);
    mockUserAuthRepo.create.mockReset().mockResolvedValue(undefined);
    mockUserAuthAppService.make.mockReset().mockImplementation((payload) => {
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
    mockEventBus.publish.mockReset().mockResolvedValue(undefined);
    mockEmailVerificationAppService.send.mockReset().mockResolvedValue(true);
    mockUserRepo.findByEmail.mockReset().mockResolvedValue(null);
    mockPasswordAppService.makePassword
      .mockReset()
      .mockImplementation((input) => input as string);
    mockPasswordAppService.hash
      .mockReset()
      .mockResolvedValue('hashed-password');
    mockRepoService.runInTransaction
      .mockReset()
      .mockImplementation(async (transactionFn) =>
        transactionFn('mock-tx' as unknown as ITransactionContext)
      );
  });

  it('should throw appError.UnprocessableEntity if payload is invalid', async () => {
    const usecase = makeSignupWithEmailUsecase({
      actorService: mockActorService,
      actorRepo: mockActorRepo,
      userIdentityService: mockUserIdentityService,
      appContext: mockAppContext,
      userRepo: mockUserRepo,
      passwordAppService: mockPasswordAppService,
      eventBus: mockEventBus,
      userAuthRepo: mockUserAuthRepo,
      userAuthAppService: mockUserAuthAppService,
      repoService: mockRepoService,
      emailVerificationAppService: mockEmailVerificationAppService,
    });

    const invalidPayload: IUserSignupReq = {
      firstName: '', // empty name
      lastName: '', // empty name
      email: 'not-an-email', // invalid email
      password: 'short', // invalid password
    };

    await expect(usecase(invalidPayload)).rejects.toThrow(
      appError.UnprocessableEntity
    );
  });

  it('should successfully sign up a new user', async () => {
    const correlationId = '854e4567-e89b-42d3-a456-426614174001';
    const idempotencyKey = 'test-idemp-key';
    mockAppContext.get.mockReturnValue({
      correlationId,
      idempotencyKey,
    } as IAppContextData);

    const payload: IUserSignupReq = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'johndoe@example.com',
      password: 'SecurePassword123!',
    };

    mockUserRepo.findByEmail.mockResolvedValue(null);
    mockPasswordAppService.hash.mockResolvedValue('hashed-password');

    const usecase = makeSignupWithEmailUsecase({
      actorService: mockActorService,
      actorRepo: mockActorRepo,
      userIdentityService: mockUserIdentityService,
      appContext: mockAppContext,
      userRepo: mockUserRepo,
      passwordAppService: mockPasswordAppService,
      eventBus: mockEventBus,
      userAuthRepo: mockUserAuthRepo,
      userAuthAppService: mockUserAuthAppService,
      repoService: mockRepoService,
      emailVerificationAppService: mockEmailVerificationAppService,
    });

    await usecase(payload);

    expect(mockAppContext.get).toHaveBeenCalledTimes(1);

    const email = emailValue.make(payload.email);
    const password = payload.password;

    // Check if user was searched by email
    expect(mockUserRepo.findByEmail).toHaveBeenCalledWith(email, {
      correlationId,
    });

    expect(mockPasswordAppService.makePassword).toHaveBeenCalledWith(password);
    expect(mockPasswordAppService.hash).toHaveBeenCalledTimes(1);
    expect(mockPasswordAppService.hash).toHaveBeenCalledWith(password);

    // Assert that save methods were called correctly
    expect(mockUserRepo.create).toHaveBeenCalledTimes(1);
    const savedUserArgs = mockUserRepo.create.mock.calls[0];
    const savedUser = savedUserArgs[0];
    const saveOptions = savedUserArgs[1];
    expect(savedUser.firstName).toBe(payload.firstName);
    expect(savedUser.lastName).toBe(payload.lastName);
    expect(savedUser.email).toBe(email);
    expect(savedUser.emailVerified).toBe(false);
    expect(saveOptions.correlationId).toBe(correlationId);
    expect(saveOptions.tx).toBe('mock-tx');
    expect(saveOptions.history.entityId).toBe(savedUser.id);
    expect(saveOptions.history.correlationId).toBe(correlationId);

    expect(mockUserAuthRepo.create).toHaveBeenCalledTimes(1);
    const [savedAuth, savedAuthOptions] = mockUserAuthRepo.create.mock.calls[0];
    expect(mockUserAuthRepo.create).toHaveBeenCalledWith(
      savedAuth,
      savedAuthOptions
    );
    expect(savedAuth.userId).toBe(savedUser.id);
    expect(savedAuth.password).toBe('hashed-password');
    expect(savedAuth.failedLoginAttempts).toBe(0);
    expect(savedAuth.strategy).toEqual(['email']);
    expect(savedAuth.createdAt).toBeInstanceOf(Date);
    expect(savedAuth.updatedAt).toBe(savedAuth.createdAt);
    expect(savedAuthOptions).toEqual({
      correlationId,
      tx: 'mock-tx',
    });

    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    const [published] = mockEventBus.publish.mock.calls[0];
    expect(Array.isArray(published)).toBe(true);
    if (!Array.isArray(published)) {
      throw new Error('Expected an event array');
    }
    expect(published).toHaveLength(2);
    expect(published[0].type).toBe('domain:actor:created');
    expect(mockActorRepo.create.mock.calls[0][0].id).toBe(savedUser.actorId);
    expect(mockActorRepo.create.mock.invocationCallOrder[0]).toBeLessThan(
      mockUserRepo.create.mock.invocationCallOrder[0]
    );
    expect(published[0].correlationId).toBe(correlationId);
    expect(published[0].idempotencyKey).toBe(idempotencyKey);
    expect(published[1].data).toBe(savedUser);
  });

  it('should wait for event publication to complete', async () => {
    const correlationId = '854e4567-e89b-42d3-a456-426614174001';
    mockAppContext.get.mockReturnValue({
      correlationId,
      idempotencyKey: 'test-idemp-key',
    } as IAppContextData);
    mockUserRepo.findByEmail.mockResolvedValue(null);
    mockPasswordAppService.hash.mockResolvedValue('hashed-password');

    let completePublication: (() => void) | undefined;
    const publication = new Promise<void>((resolve) => {
      completePublication = resolve;
    });
    mockEventBus.publish.mockReturnValue(publication);

    const usecase = makeSignupWithEmailUsecase({
      actorService: mockActorService,
      actorRepo: mockActorRepo,
      userIdentityService: mockUserIdentityService,
      appContext: mockAppContext,
      userRepo: mockUserRepo,
      passwordAppService: mockPasswordAppService,
      eventBus: mockEventBus,
      userAuthRepo: mockUserAuthRepo,
      userAuthAppService: mockUserAuthAppService,
      repoService: mockRepoService,
      emailVerificationAppService: mockEmailVerificationAppService,
    });

    let signupCompleted = false;
    const signup = usecase({
      firstName: 'John',
      lastName: 'Doe',
      email: 'johndoe@example.com',
      password: 'SecurePassword123!',
    }).then(() => {
      signupCompleted = true;
    });

    await new Promise<void>((resolve) => setImmediate(resolve));
    const completedBeforePublication = signupCompleted;

    completePublication?.();
    await signup;

    expect(completedBeforePublication).toBe(false);
  });

  it('stops signup before user creation when actor persistence fails', async () => {
    mockAppContext.get.mockReturnValue({
      correlationId: '854e4567-e89b-42d3-a456-426614174001',
    } as IAppContextData);
    const failure = new Error('actor create failed');
    mockActorRepo.create.mockRejectedValue(failure);
    const usecase = makeSignupWithEmailUsecase({
      actorService: mockActorService,
      actorRepo: mockActorRepo,
      userIdentityService: mockUserIdentityService,
      appContext: mockAppContext,
      userRepo: mockUserRepo,
      passwordAppService: mockPasswordAppService,
      eventBus: mockEventBus,
      userAuthRepo: mockUserAuthRepo,
      userAuthAppService: mockUserAuthAppService,
      repoService: mockRepoService,
      emailVerificationAppService: mockEmailVerificationAppService,
    });

    await expect(
      usecase({
        firstName: 'John',
        lastName: 'Doe',
        email: 'johndoe@example.com',
        password: 'SecurePassword123!',
      })
    ).rejects.toBe(failure);

    expect(mockUserRepo.create).not.toHaveBeenCalled();
    expect(mockUserAuthRepo.create).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    expect(mockEmailVerificationAppService.send).not.toHaveBeenCalled();
  });

  it('should not create auth data or publish when user creation fails', async () => {
    mockAppContext.get.mockReturnValue({
      correlationId: '854e4567-e89b-42d3-a456-426614174001',
      idempotencyKey: 'test-idemp-key',
    } as IAppContextData);
    mockUserRepo.findByEmail.mockResolvedValue(null);
    mockPasswordAppService.hash.mockResolvedValue('hashed-password');
    mockUserRepo.create.mockRejectedValue(new Error('user create failed'));

    const usecase = makeSignupWithEmailUsecase({
      actorService: mockActorService,
      actorRepo: mockActorRepo,
      userIdentityService: mockUserIdentityService,
      appContext: mockAppContext,
      userRepo: mockUserRepo,
      passwordAppService: mockPasswordAppService,
      eventBus: mockEventBus,
      userAuthRepo: mockUserAuthRepo,
      userAuthAppService: mockUserAuthAppService,
      repoService: mockRepoService,
      emailVerificationAppService: mockEmailVerificationAppService,
    });

    await expect(
      usecase({
        firstName: 'John',
        lastName: 'Doe',
        email: 'johndoe@example.com',
        password: 'SecurePassword123!',
      })
    ).rejects.toThrow('user create failed');

    expect(mockUserAuthRepo.create).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('should not publish when auth data creation fails', async () => {
    mockAppContext.get.mockReturnValue({
      correlationId: '854e4567-e89b-42d3-a456-426614174001',
      idempotencyKey: 'test-idemp-key',
    } as IAppContextData);
    mockUserRepo.findByEmail.mockResolvedValue(null);
    mockPasswordAppService.hash.mockResolvedValue('hashed-password');
    mockUserAuthRepo.create.mockRejectedValue(
      new Error('user auth create failed')
    );

    const usecase = makeSignupWithEmailUsecase({
      actorService: mockActorService,
      actorRepo: mockActorRepo,
      userIdentityService: mockUserIdentityService,
      appContext: mockAppContext,
      userRepo: mockUserRepo,
      passwordAppService: mockPasswordAppService,
      eventBus: mockEventBus,
      userAuthRepo: mockUserAuthRepo,
      userAuthAppService: mockUserAuthAppService,
      repoService: mockRepoService,
      emailVerificationAppService: mockEmailVerificationAppService,
    });

    await expect(
      usecase({
        firstName: 'John',
        lastName: 'Doe',
        email: 'johndoe@example.com',
        password: 'SecurePassword123!',
      })
    ).rejects.toThrow('user auth create failed');

    expect(mockUserRepo.create).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('should return the generic response and request verification if user already exists', async () => {
    const correlationId = '854e4567-e89b-42d3-a456-426614174001';
    mockAppContext.get.mockReturnValue({
      correlationId,
    } as IAppContextData);

    const payload: IUserSignupReq = {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'janedoe@example.com',
      password: 'SecurePassword123!',
    };

    const existingUser: IUser = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: '854e4567-e89b-42d3-a456-426614174002' as TEntityId,
      firstName: 'Existing',
      lastName: 'User',
      email: payload.email,
      emailVerified: false,
      version: 1,
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      updatedAt: new Date('2025-01-01T00:00:00.000Z'),
      deletedAt: null,
    };
    mockUserRepo.findByEmail.mockResolvedValue(existingUser);

    const usecase = makeSignupWithEmailUsecase({
      actorService: mockActorService,
      actorRepo: mockActorRepo,
      userIdentityService: mockUserIdentityService,
      appContext: mockAppContext,
      userRepo: mockUserRepo,
      passwordAppService: mockPasswordAppService,
      eventBus: mockEventBus,
      userAuthRepo: mockUserAuthRepo,
      userAuthAppService: mockUserAuthAppService,
      repoService: mockRepoService,
      emailVerificationAppService: mockEmailVerificationAppService,
    });

    await expect(usecase(payload)).resolves.toBeUndefined();

    expect(mockUserRepo.findByEmail).toHaveBeenCalledTimes(1);
    expect(mockEmailVerificationAppService.send).toHaveBeenCalledWith(
      existingUser,
      correlationId
    );
    expect(mockPasswordAppService.hash).toHaveBeenCalledWith(payload.password);
    expect(mockUserRepo.create).not.toHaveBeenCalled();
    expect(mockUserAuthRepo.create).not.toHaveBeenCalled();
  });

  it('propagates persistence failures', async () => {
    mockAppContext.get.mockReturnValue({
      correlationId: '854e4567-e89b-42d3-a456-426614174001',
      idempotencyKey: 'test-idemp-key',
    } as IAppContextData);
    const persistenceFailure = new Error('persistence failure');
    mockRepoService.runInTransaction.mockRejectedValue(persistenceFailure);

    const usecase = makeSignupWithEmailUsecase({
      actorService: mockActorService,
      actorRepo: mockActorRepo,
      userIdentityService: mockUserIdentityService,
      appContext: mockAppContext,
      userRepo: mockUserRepo,
      passwordAppService: mockPasswordAppService,
      eventBus: mockEventBus,
      userAuthRepo: mockUserAuthRepo,
      userAuthAppService: mockUserAuthAppService,
      repoService: mockRepoService,
      emailVerificationAppService: mockEmailVerificationAppService,
    });

    await expect(
      usecase({
        firstName: 'Grace',
        lastName: 'Hopper',
        email: 'grace@example.com',
        password: 'CompilerDesign1!',
      })
    ).rejects.toBe(persistenceFailure);

    expect(mockEmailVerificationAppService.send).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('propagates event publication failures', async () => {
    mockAppContext.get.mockReturnValue({
      correlationId: '854e4567-e89b-42d3-a456-426614174001',
      idempotencyKey: 'test-idemp-key',
    } as IAppContextData);
    const publicationFailure = new Error('publication failed');
    mockEventBus.publish.mockRejectedValue(publicationFailure);

    const usecase = makeSignupWithEmailUsecase({
      actorService: mockActorService,
      actorRepo: mockActorRepo,
      userIdentityService: mockUserIdentityService,
      appContext: mockAppContext,
      userRepo: mockUserRepo,
      passwordAppService: mockPasswordAppService,
      eventBus: mockEventBus,
      userAuthRepo: mockUserAuthRepo,
      userAuthAppService: mockUserAuthAppService,
      repoService: mockRepoService,
      emailVerificationAppService: mockEmailVerificationAppService,
    });

    await expect(
      usecase({
        firstName: 'Grace',
        lastName: 'Hopper',
        email: 'grace@example.com',
        password: 'CompilerDesign1!',
      })
    ).rejects.toBe(publicationFailure);
  });
});
