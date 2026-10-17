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
