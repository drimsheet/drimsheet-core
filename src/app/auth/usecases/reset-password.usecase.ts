import IEventBus from '@shared/contracts/event-bus.contract';
import {
  IRepoService,
  TRepoTransactionFn,
} from '@shared/contracts/repo.contract';
import IReporter from '@shared/contracts/reporter.contract';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';

import userEvents from '@domain/user/events/user.events';
import IUserRepo from '@domain/user/repos/user.repo';
import IActorService from '@domain/user/types/actor.service.types';
import { IUser } from '@domain/user/types/user.types';

import IPasswordAppService from '@app/auth/contracts/password-service.contract';
import ITokenAppService from '@app/auth/contracts/token-service.contract';
import IUserAuthRepo from '@app/auth/contracts/user-auth.repo.contract';
import IUserAuthAppService from '@app/auth/contracts/user-auth.service.contract';
import IUserSessionPersistenceAppService from '@app/auth/contracts/user-session-persistence.service.contract';
import IUserSessionAppService, {
  IPreparedUserSession,
} from '@app/auth/contracts/user-session.service.contract';
import { IAccessToken, IResetPasswordReq } from '@app/auth/dtos/auth/auth.dto';
import { resetPasswordReqValidation } from '@app/auth/dtos/auth/auth.dto.validation';
import authError from '@app/auth/errors/auth.error';
import IAppContext from '@app/context/contracts/app-context.contract';

interface IDependencies {
  actorService: IActorService;
  appContext: IAppContext;
  userRepo: IUserRepo;
  passwordAppService: IPasswordAppService;
  tokenAppService: ITokenAppService;
  eventBus: IEventBus;
  userAuthRepo: IUserAuthRepo;
  userAuthAppService: IUserAuthAppService;
  userSessionAppService: IUserSessionAppService;
  userSessionPersistenceAppService: IUserSessionPersistenceAppService;
  repoService: IRepoService;
  reporter: IReporter;
}

const operations = {
  tokenClaim: 'release-password-reset-token-claim',
  finalization: 'finalize-password-reset-token',
};

export default function makeResetPasswordUseCase(deps: IDependencies) {
  return async (payload: IResetPasswordReq): Promise<IAccessToken> => {
    zodValidationRunner(resetPasswordReqValidation, payload);

    const { correlationId, idempotencyKey } = deps.appContext.get();

    const tokenPayload = await deps.tokenAppService.claimPasswordResetToken(
      payload.token
    );

    let existingUser!: IUser;
    let preparedSession!: IPreparedUserSession;

    try {
      const user = await deps.userRepo.findById(tokenPayload.id, {
        correlationId,
      });

      if (!user) {
        throw new authError.InvalidToken();
      }

      await deps.actorService.resolveUser(user, { correlationId });

      const existingUserAuth = await deps.userAuthRepo.findByUserId(user.id, {
        correlationId,
      });

      if (!existingUserAuth) {
        throw new authError.InvalidToken();
      }

      const password = deps.passwordAppService.makePassword(payload.password);
      const passwordHash = await deps.passwordAppService.hash(password);
      preparedSession = await deps.userSessionAppService.prepare(user);
      const updatedUserAuth = deps.userAuthAppService.replacePassword(
        existingUserAuth,
        passwordHash
      );

      const repoTransaction: TRepoTransactionFn = async (tx) => {
        await deps.userAuthRepo.update(updatedUserAuth, {
          correlationId,
          expectedVersion: existingUserAuth.version,
          tx,
        });
        await deps.userSessionPersistenceAppService.replaceAllUserSessions(
          preparedSession.userSession,
          { correlationId, tx }
        );
      };
      await deps.repoService.runInTransaction(repoTransaction);
      existingUser = user;
    } catch (error) {
      try {
        await deps.tokenAppService.releasePasswordResetTokenClaim(tokenPayload);
      } catch (cleanupError) {
        deps.reporter.report(
          'auth.password_reset.claim_release_failed',
          cleanupError,
          { operation: operations.tokenClaim }
        );
      }

      throw error;
    }

    try {
      await deps.tokenAppService.finalizePasswordResetToken(tokenPayload);
    } catch (error) {
      deps.reporter.report('auth.password_reset.finalization_failed', error, {
        operation: operations.finalization,
      });
    }

    deps.appContext
      .get(['clientSession'])
      .clientSession.setRefreshToken(preparedSession.refreshToken);

    const event = userEvents.passwordReset(existingUser);
    await deps.eventBus.publish(
      eventValue.enrich(event, { correlationId, idempotencyKey })
    );

    return { accessToken: preparedSession.accessToken };
  };
}
