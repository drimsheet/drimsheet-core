/**
 * SUMMARY
 * Completes Google sign-in for an already resolved local user. Replaces the
 * presented client session and sets its refresh token, then returns the web
 * application OAuth confirmation URL. Does not return an access token or
 * publish a login event.
 *
 * WHEN TO USE
 * Use after Google profile resolution succeeds to establish the client session
 * and obtain the redirect destination.
 *
 * SEQUENCE DIAGRAM
 * @see ./__docs__/oauth.sequence.md
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';

import IActorService from '@domain/user/types/actor.service.types';
import { IUser } from '@domain/user/types/user.types';

import IUserSessionPersistenceAppService from '@app/auth/contracts/user-session-persistence.service.contract';
import IUserSessionAppService from '@app/auth/contracts/user-session.service.contract';
import { IAppContextData } from '@app/context/types/app-context.types';

interface IDependencies {
  actorService: IActorService;
  reqContext: IAppContextService<IAppContextData>;
  userSessionAppService: IUserSessionAppService;
  userSessionPersistenceAppService: IUserSessionPersistenceAppService;
  webAppUrl: string;
}

export default function makeOauthUsecase(deps: IDependencies) {
  return {
    handleGoogleCallback: async (user: IUser): Promise<string> => {
      const { correlationId, clientSession } = deps.reqContext.get([
        'clientSession',
      ]);
      await deps.actorService.resolveUser(user, { correlationId });
      const preparedSession = await deps.userSessionAppService.prepare(
        user,
        clientSession.getRefreshToken()
      );

      await deps.userSessionPersistenceAppService.replaceClientSession(
        {
          userSession: preparedSession.userSession,
          priorClientSession: preparedSession.priorClientSession,
        },
        { correlationId }
      );

      clientSession.setRefreshToken(preparedSession.refreshToken);

      return `${deps.webAppUrl}/auth/oauth-confirmation`;
    },
  };
}
