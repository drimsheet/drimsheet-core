import { TEntityId } from '@shared/types/uuid';

import { IUser } from '@domain/user/types/user.types';
import emailValue from '@domain/user/values/email.vo';

import mockUserSessionPersistenceAppService from '@app/auth/contracts/__mocks__/user-session-persistence.service.mock';
import mockUserSessionAppService from '@app/auth/contracts/__mocks__/user-session.service.mock';
import makeOauthUsecase from '@app/auth/usecases/oauth.usecase';
import mockAppContext, {
  mockClientSession,
} from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/contracts/app-context.contract';
import { mockActorService } from '@app/user/contracts/__mocks__/actor.services.mock';

describe('makeOauthUsecase', () => {
  const correlationId = 'test-corr-id';
  const webAppUrl = 'http://localhost:3000';
  const userId = '123e4567-e89b-42d3-a456-426614174000' as TEntityId;
  const user = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: userId,
    email: emailValue.make('johndoe@example.com'),
  } as unknown as IUser;
  const userSession = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: '123e4567-e89b-42d3-a456-426614174001' as TEntityId,
    userId,
    refreshToken: 'new-refresh-token',
    lastLoginAt: new Date('2026-04-01T00:00:00.000Z'),
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
  };

  const getUseCase = () =>
    makeOauthUsecase({
      actorService: mockActorService,
      reqContext: mockAppContext,
      userSessionAppService: mockUserSessionAppService,
      userSessionPersistenceAppService: mockUserSessionPersistenceAppService,
      webAppUrl,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAppContext.get.mockReturnValue({
      correlationId,
      clientSession: mockClientSession,
    } as unknown as IAppContextData);
    mockUserSessionPersistenceAppService.replaceClientSession.mockReset();
  });

  it('persists a prepared session, exposes its refresh token, and returns the redirect URL', async () => {
    mockClientSession.getRefreshToken.mockReturnValue(null);
    mockUserSessionAppService.prepare.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'new-refresh-token',
      userSession,
      priorClientSession: null,
    });

    const redirectUrl = await getUseCase().handleGoogleCallback(user);

    expect(mockUserSessionAppService.prepare).toHaveBeenCalledWith(user, null);
    expect(
      mockUserSessionPersistenceAppService.replaceClientSession
    ).toHaveBeenCalledWith(
      { userSession, priorClientSession: null },
      { correlationId }
    );
    expect(mockClientSession.setRefreshToken).toHaveBeenCalledWith(
      'new-refresh-token'
    );
    expect(redirectUrl).toBe('http://localhost:3000/auth/oauth-confirmation');
  });

  it('forwards the prior client-session reference prepared from the current token', async () => {
    const priorClientSession = {
      userId,
      refreshToken: 'old-refresh-token',
    };
    mockClientSession.getRefreshToken.mockReturnValue('old-refresh-token');
    mockUserSessionAppService.prepare.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'new-refresh-token',
      userSession,
      priorClientSession,
    });

    await getUseCase().handleGoogleCallback(user);

    expect(mockUserSessionAppService.prepare).toHaveBeenCalledWith(
      user,
      'old-refresh-token'
    );
    expect(
      mockUserSessionPersistenceAppService.replaceClientSession
    ).toHaveBeenCalledWith(
      { userSession, priorClientSession },
      { correlationId }
    );
  });

  it('does not expose the refresh token when persistence fails', async () => {
    mockClientSession.getRefreshToken.mockReturnValue(null);
    mockUserSessionAppService.prepare.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'new-refresh-token',
      userSession,
      priorClientSession: null,
    });
    mockUserSessionPersistenceAppService.replaceClientSession.mockRejectedValue(
      new Error('persistence failed')
    );

    await expect(getUseCase().handleGoogleCallback(user)).rejects.toThrow(
      'persistence failed'
    );

    expect(mockClientSession.setRefreshToken).not.toHaveBeenCalled();
  });
});
