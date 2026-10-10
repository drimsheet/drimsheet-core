import appError from '@shared/values/errors/app.error';

import IUserRepo from '@domain/user/repos/user.repo';
import IActorService from '@domain/user/types/actor.service.types';

import ITokenAppService from '@app/auth/contracts/token-service.contract';
import IUserSessionPersistenceAppService from '@app/auth/contracts/user-session-persistence.service.contract';
import IUserSessionAppService from '@app/auth/contracts/user-session.service.contract';
import authError from '@app/auth/errors/auth.error';
import IAppContext from '@app/context/contracts/app-context.contract';

interface IDependencies {
  actorService: IActorService;
  reqContext: IAppContext;
  userRepo: IUserRepo;
  tokenAppService: ITokenAppService;
  userSessionAppService: IUserSessionAppService;
  userSessionPersistenceAppService: IUserSessionPersistenceAppService;
}

export default function makeRefreshAccessTokenUseCase(deps: IDependencies) {
  return async () => {
    const { clientSession, correlationId } = deps.reqContext.get([
      'clientSession',
    ]);

    const refreshToken = clientSession.getRefreshToken();

    if (!refreshToken) {
      clientSession.clearRefreshToken();
      throw new appError.Unauthorized();
    }

    try {
      const decoded = deps.tokenAppService.verifyRefreshToken(refreshToken);

      const user = await deps.userRepo.findById(decoded.id, { correlationId });

      if (!user) {
        throw new appError.Unauthorized();
      }

      await deps.actorService.resolveUser(user, { correlationId });
      const preparedSession = await deps.userSessionAppService.prepare(user);
      const wasRotated =
        await deps.userSessionPersistenceAppService.rotateSession(
          {
            userSession: preparedSession.userSession,
            presentedSession: { userId: user.id, refreshToken },
          },
          { correlationId }
        );

      if (!wasRotated) {
        throw new appError.Unauthorized();
      }

      clientSession.setRefreshToken(preparedSession.refreshToken);

      return { accessToken: preparedSession.accessToken };
    } catch (error) {
      if (
        error instanceof authError.Base ||
        error instanceof appError.Unauthorized
      ) {
        clientSession.clearRefreshToken();
      }
      throw error;
    }
  };
}
