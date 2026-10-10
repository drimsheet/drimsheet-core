import mockLogger from '@shared/contracts/__mocks__/logger.mock';
import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IUser } from '@domain/user/types/user.types';
import emailValue from '@domain/user/values/email.vo';

import mockEmailVerificationAppService from '@app/auth/contracts/__mocks__/email-verification.service.mock';
import authError from '@app/auth/errors/auth.error';
import makeSendEmailVerificationEmailUseCase from '@app/auth/usecases/send-email-verification-email.usecase';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/contracts/app-context.contract';
import { mockUserRepo } from '@app/user/contracts/__mocks__/user.repos.mock';

describe('makeSendEmailVerificationEmailUseCase', () => {
  const correlationId = 'test-corr-id';
  const makeUseCase = () =>
    makeSendEmailVerificationEmailUseCase({
      appContext: mockAppContext,
      logger: mockLogger,
      userRepo: mockUserRepo,
      emailVerificationAppService: mockEmailVerificationAppService,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAppContext.get.mockReturnValue({
      correlationId,
    } as IAppContextData);
    mockEmailVerificationAppService.send.mockResolvedValue(true);
  });

  it('rejects an invalid email', async () => {
    await expect(makeUseCase()('invalid-email')).rejects.toThrow(
      appError.UnprocessableEntity
    );
  });

  it('throws when the user is not found', async () => {
    const userEmail = 'notfound@example.com';
    mockUserRepo.findByEmail.mockResolvedValue(null);

    await expect(makeUseCase()(userEmail)).rejects.toThrow(
      authError.UserNotFound
    );
    expect(mockUserRepo.findByEmail).toHaveBeenCalledWith(
      emailValue.normalize(userEmail),
      { correlationId }
    );
    expect(mockEmailVerificationAppService.send).not.toHaveBeenCalled();
  });

  it('logs and returns when the email is already verified', async () => {
    const user: IUser = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: 'test-user-id' as TEntityId,
      email: emailValue.make('verified@example.com'),
      emailVerified: true,
      firstName: 'John',
      lastName: 'Doe',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    mockUserRepo.findByEmail.mockResolvedValue(user);

    await makeUseCase()(user.email);

    expect(mockLogger.info).toHaveBeenCalledWith(
      'auth.email_verification.skipped',
      {
        message:
          'Skipping email verification because the user is already verified',
        outcome: 'skipped',
      }
    );
    expect(mockEmailVerificationAppService.send).not.toHaveBeenCalled();
  });

  it('delegates delivery for an unverified user', async () => {
    const user: IUser = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: 'test-user-id' as TEntityId,
      email: emailValue.make('unverified@example.com'),
      emailVerified: false,
      firstName: 'John',
      lastName: 'Doe',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    mockUserRepo.findByEmail.mockResolvedValue(user);

    await makeUseCase()(user.email);

    expect(mockEmailVerificationAppService.send).toHaveBeenCalledWith(
      user,
      correlationId
    );
  });
});
