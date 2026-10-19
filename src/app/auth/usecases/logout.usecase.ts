import IAppContextService from '@shared/contracts/app-context.service.contract';

import ITokenAppService from '@app/auth/contracts/token-service.contract';
import IUserSessionRepo from '@app/auth/contracts/user-session.repo.contract';
import authError from '@app/auth/errors/auth.error';
import { IAppContextData } from '@app/context/types/app-context.types';

interface IDependencies {
  reqContext: IAppContextService<IAppContextData>;
  tokenAppService: ITokenAppService;
  userSessionRepo: IUserSessionRepo;
}

export default function makeLogoutUseCase(deps: IDependencies) {
  return async () => {
    const { clientSession, correlationId } = deps.reqContext.get([
      'clientSession',
    ]);

    const refreshToken = clientSession.getRefreshToken();

    if (!refreshToken) {
      clientSession.clearRefreshToken();
      return;
    }

    let decoded;

    try {
      decoded = deps.tokenAppService.verifyRefreshToken(refreshToken);
    } catch (error) {
      if (!(error instanceof authError.Base)) {
        throw error;
      }

      clientSession.clearRefreshToken();
      return;
    }

    await deps.userSessionRepo.delete(decoded.id, refreshToken, {
      correlationId,
    });

    clientSession.clearRefreshToken();
  };
}
