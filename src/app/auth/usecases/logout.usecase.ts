import ITokenAppService from '@app/auth/contracts/token-service.contract';
import IUserSessionRepo from '@app/auth/contracts/user-session.repo.contract';
import authError from '@app/auth/errors/auth.error';
import IAppContext from '@app/context/contracts/app-context.contract';

interface IDependencies {
  reqContext: IAppContext;
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
