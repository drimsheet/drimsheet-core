import IEventBus from '@shared/contracts/event-bus.contract';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';

import userEvents from '@domain/user/events/user.events';
import IUserRepo from '@domain/user/repos/user.repo';
import IActorService from '@domain/user/types/actor.service.types';
import emailValue from '@domain/user/values/email.vo';

import { EAuthStrategy } from '@app/auth/contracts/auth.types';
import IPasswordAppService from '@app/auth/contracts/password-service.contract';
import IUserAuthRepo from '@app/auth/contracts/user-auth.repo.contract';
import IUserAuthAppService from '@app/auth/contracts/user-auth.service.contract';
import IUserSessionPersistenceAppService from '@app/auth/contracts/user-session-persistence.service.contract';
import IUserSessionAppService from '@app/auth/contracts/user-session.service.contract';
import { IAccessToken, IEmailLoginReq } from '@app/auth/dtos/auth/auth.dto';
import { emailLoginReqValidation } from '@app/auth/dtos/auth/auth.dto.validation';
import authError from '@app/auth/errors/auth.error';
import IAppContext from '@app/context/contracts/app-context.contract';

interface IDependencies {
  actorService: IActorService;
  reqContext: IAppContext;
  userRepo: IUserRepo;
  passwordAppService: IPasswordAppService;
  eventBus: IEventBus;
  userAuthRepo: IUserAuthRepo;
  userAuthAppService: IUserAuthAppService;
  userSessionAppService: IUserSessionAppService;
  userSessionPersistenceAppService: IUserSessionPersistenceAppService;
}

export default function makeLoginWithEmailUseCase(deps: IDependencies) {
  return async (payload: IEmailLoginReq): Promise<IAccessToken> => {
    zodValidationRunner(emailLoginReqValidation, payload);

    const { correlationId, clientSession } = deps.reqContext.get([
      'clientSession',
    ]);

    const email = emailValue.normalize(payload.email);

    const user = await deps.userRepo.findByEmail(email, { correlationId });

    if (!user) {
      throw new authError.InvalidCredentials();
    }

    const userAuth = await deps.userAuthRepo.findByUserId(user.id, {
      correlationId,
    });

    if (!userAuth) {
      throw new authError.InvalidCredentials();
    }

    const MAX_LOGIN_ATTEMPTS = 5;

    if (userAuth.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
      throw new authError.InvalidCredentials();
    }

    if (
      !userAuth.strategy.includes(EAuthStrategy.Email) ||
      !userAuth.password
    ) {
      const updatedUserAuth =
        deps.userAuthAppService.recordFailedLogin(userAuth);

      await deps.userAuthRepo.update(updatedUserAuth, {
        correlationId,
        expectedVersion: userAuth.version,
      });
      throw new authError.InvalidCredentials();
    }

    const isValidPassword = await deps.passwordAppService.compare(
      payload.password,
      userAuth.password
    );

    if (!isValidPassword) {
      const updatedUserAuth =
        deps.userAuthAppService.recordFailedLogin(userAuth);

      await deps.userAuthRepo.update(updatedUserAuth, {
        correlationId,
        expectedVersion: userAuth.version,
      });
      throw new authError.InvalidCredentials();
    }

    if (userAuth.failedLoginAttempts > 0) {
      const updatedUserAuth =
        deps.userAuthAppService.resetFailedLoginAttempts(userAuth);

      await deps.userAuthRepo.update(updatedUserAuth, {
        correlationId,
        expectedVersion: userAuth.version,
      });
    }

    const events = eventValue.enrich(userEvents.loggedIn(user), {
      correlationId,
    });
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
    await deps.eventBus.publish(events);

    return { accessToken: preparedSession.accessToken };
  };
}
