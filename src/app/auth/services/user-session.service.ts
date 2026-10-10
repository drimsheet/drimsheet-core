import generateUUID from '@shared/utils/uuid-generator';

import ITokenAppService from '@app/auth/contracts/token-service.contract';
import IUserSessionAppService from '@app/auth/contracts/user-session.service.contract';

interface IDependencies {
  tokenAppService: ITokenAppService;
}

/**
 * Creates the capability that prepares credentials, an immutable session
 * record, and an optional prior-client reference without persisting them.
 */
function makePrepare(deps: IDependencies): IUserSessionAppService['prepare'] {
  return async (user, priorClientRefreshToken = null) => {
    const accessToken = await deps.tokenAppService.generateAccessToken(user);
    const refreshToken = await deps.tokenAppService.generateRefreshToken(user);
    const timestamp = new Date();

    let priorClientSession = null;
    if (priorClientRefreshToken) {
      let priorUserId = user.id;

      try {
        priorUserId = deps.tokenAppService.verifyRefreshToken(
          priorClientRefreshToken
        ).id;
      } catch {
        // The current user's ID preserves cleanup for an unparseable token.
      }

      priorClientSession = Object.freeze({
        userId: priorUserId,
        refreshToken: priorClientRefreshToken,
      });
    }

    const userSession = Object.freeze({
      id: generateUUID(),
      createdBy: user.actorId,
      userId: user.id,
      refreshToken,
      lastLoginAt: timestamp,
      createdAt: timestamp,
    });

    return Object.freeze({
      accessToken,
      refreshToken,
      userSession,
      priorClientSession,
    });
  };
}

/** Composes the immutable user-session service from its capability. */
export default function makeUserSessionAppService(deps: IDependencies) {
  const service: IUserSessionAppService = {
    prepare: makePrepare(deps),
  };

  return Object.freeze(service);
}
