import IEventBus from '@shared/contracts/event-bus.contract';
import {
  IRepoService,
  TRepoTransactionFn,
} from '@shared/contracts/repo.contract';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import IActorRepo from '@domain/user/repos/actor.repo';
import IUserRepo from '@domain/user/repos/user.repo';
import IActorService from '@domain/user/types/actor.service.types';
import IUserIdentityService from '@domain/user/types/user-identity.service.types';
import emailValue from '@domain/user/values/email.vo';

import { EAuthStrategy } from '@app/auth/contracts/auth.types';
import IEmailVerificationAppService from '@app/auth/contracts/email-verification-service.contract';
import IPasswordAppService from '@app/auth/contracts/password-service.contract';
import IUserAuthRepo from '@app/auth/contracts/user-auth.repo.contract';
import IUserAuthAppService from '@app/auth/contracts/user-auth.service.contract';
import { IUserSignupReq } from '@app/auth/dtos/auth/auth.dto';
import { userSignupReqValidation } from '@app/auth/dtos/auth/auth.dto.validation';
import IAppContext from '@app/context/contracts/app-context.contract';

interface IDependencies {
  actorRepo: IActorRepo;
  actorService: IActorService;
  userIdentityService: IUserIdentityService;
  appContext: IAppContext;
  userRepo: IUserRepo;
  passwordAppService: IPasswordAppService;
  eventBus: IEventBus;
  userAuthRepo: IUserAuthRepo;
  userAuthAppService: IUserAuthAppService;
  repoService: IRepoService;
  emailVerificationAppService: IEmailVerificationAppService;
}

export default function makeSignupWithEmailUsecase(deps: IDependencies) {
  return async (payload: IUserSignupReq): Promise<void> => {
    zodValidationRunner(userSignupReqValidation, payload);

    const { correlationId, idempotencyKey } = deps.appContext.get();

    const email = emailValue.make(payload.email);

    const password = deps.passwordAppService.makePassword(payload.password);
    const passwordHash = await deps.passwordAppService.hash(password);

    const existingUser = await deps.userRepo.findByEmail(email, {
      correlationId,
    });

    if (existingUser) {
      await deps.actorService.resolveUser(existingUser, { correlationId });
      await deps.emailVerificationAppService.send(existingUser, correlationId);
      return;
    }

    const identity = deps.userIdentityService.create({
      firstName: payload.firstName,
      lastName: payload.lastName,
      email,
      emailVerified: false,
    });

    const [actor, actorEvents, actorAudit] = identity.actor;
    const [user, userEvents, userAudit] = identity.user;
    const actorHistory = historyValue.make(actorAudit, actor.id, correlationId);

    const history = historyValue.make(userAudit, user.actorId, correlationId);

    const userAuth = deps.userAuthAppService.make({
      userId: user.id,
      createdBy: actor.id,
      password: passwordHash,
      strategy: EAuthStrategy.Email,
    });

    const repoTransaction: TRepoTransactionFn = async (tx) => {
      await deps.actorRepo.create(actor, {
        correlationId,
        tx,
        history: actorHistory,
      });
      await deps.userRepo.create(user, { correlationId, tx, history });
      await deps.userAuthRepo.create(userAuth, { correlationId, tx });
    };

    await deps.repoService.runInTransaction(repoTransaction);

    const enrichedUserEvents = [...actorEvents, ...userEvents].map((e) =>
      eventValue.enrich<unknown>(e, { correlationId, idempotencyKey })
    );

    await deps.eventBus.publish(enrichedUserEvents);

    await deps.emailVerificationAppService.send(user, correlationId);
  };
}
