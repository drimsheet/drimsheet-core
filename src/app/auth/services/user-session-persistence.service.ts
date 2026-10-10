import {
  IRepoService,
  TRepoTransactionFn,
} from '@shared/contracts/repo.contract';

import IUserSessionPersistenceAppService from '@app/auth/contracts/user-session-persistence.service.contract';
import IUserSessionRepo from '@app/auth/contracts/user-session.repo.contract';

interface IDependencies {
  userSessionRepo: IUserSessionRepo;
  repoService: IRepoService;
}

/** Removes any stored session that collides with a generated refresh token. */
async function removeGeneratedTokenCollision(
  deps: IDependencies,
  userId: string,
  refreshToken: string,
  repoOptions: Parameters<IUserSessionRepo['delete']>[2]
) {
  await deps.userSessionRepo.delete(userId, refreshToken, repoOptions);
}

/**
 * Creates the capability that atomically replaces an optional prior client
 * session with a prepared session.
 */
function makeReplaceClientSession(
  deps: IDependencies
): IUserSessionPersistenceAppService['replaceClientSession'] {
  return async (payload, repoOptions) => {
    const transactionFn: TRepoTransactionFn = async (tx) => {
      const writeOptions = { ...repoOptions, tx };

      if (payload.priorClientSession) {
        await deps.userSessionRepo.delete(
          payload.priorClientSession.userId,
          payload.priorClientSession.refreshToken,
          writeOptions
        );
      }

      await removeGeneratedTokenCollision(
        deps,
        payload.userSession.userId,
        payload.userSession.refreshToken,
        writeOptions
      );
      await deps.userSessionRepo.create(payload.userSession, writeOptions);
    };

    await deps.repoService.runInTransaction(transactionFn, repoOptions.tx);
  };
}

/**
 * Creates the capability that atomically consumes a required presented
 * session before writing its prepared replacement.
 */
function makeRotateSession(
  deps: IDependencies
): IUserSessionPersistenceAppService['rotateSession'] {
  return async (payload, repoOptions) => {
    const transactionFn: TRepoTransactionFn<boolean> = async (tx) => {
      const writeOptions = { ...repoOptions, tx };
      const wasConsumed = await deps.userSessionRepo.delete(
        payload.presentedSession.userId,
        payload.presentedSession.refreshToken,
        writeOptions
      );

      if (!wasConsumed) return false;

      await removeGeneratedTokenCollision(
        deps,
        payload.userSession.userId,
        payload.userSession.refreshToken,
        writeOptions
      );
      await deps.userSessionRepo.create(payload.userSession, writeOptions);

      return true;
    };

    return deps.repoService.runInTransaction(transactionFn, repoOptions.tx);
  };
}

/**
 * Creates the capability that atomically revokes every user session before
 * writing the prepared replacement.
 */
function makeReplaceAllUserSessions(
  deps: IDependencies
): IUserSessionPersistenceAppService['replaceAllUserSessions'] {
  return async (userSession, repoOptions) => {
    const transactionFn: TRepoTransactionFn = async (tx) => {
      const writeOptions = { ...repoOptions, tx };

      await deps.userSessionRepo.deleteAllByUserId(
        userSession.userId,
        writeOptions
      );
      await deps.userSessionRepo.create(userSession, writeOptions);
    };

    await deps.repoService.runInTransaction(transactionFn, repoOptions.tx);
  };
}

/**
 * Composes the immutable user-session persistence service from its atomic
 * write capabilities.
 */
export default function makeUserSessionPersistenceAppService(
  deps: IDependencies
): IUserSessionPersistenceAppService {
  const service: IUserSessionPersistenceAppService = {
    replaceClientSession: makeReplaceClientSession(deps),
    rotateSession: makeRotateSession(deps),
    replaceAllUserSessions: makeReplaceAllUserSessions(deps),
  };

  return Object.freeze(service);
}
