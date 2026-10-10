import IEventBus from '@shared/contracts/event-bus.contract';
import {
  IRepoService,
  TRepoTransactionFn,
} from '@shared/contracts/repo.contract';
import appError from '@shared/values/errors/app.error';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import IActorRepo from '@domain/user/repos/actor.repo';
import IUserRepo from '@domain/user/repos/user.repo';
import IActorService from '@domain/user/types/actor.service.types';
import IUserIdentityService from '@domain/user/types/user-identity.service.types';
import emailValue from '@domain/user/values/email.vo';

import { EAuthStrategy } from '@app/auth/contracts/auth.types';
import IUserAuthRepo from '@app/auth/contracts/user-auth.repo.contract';
import IUserAuthAppService from '@app/auth/contracts/user-auth.service.contract';
import {
  IOAuthProfile,
  TOAuthDoneCallback,
} from '@app/auth/dtos/auth/auth.dto';
import authError from '@app/auth/errors/auth.error';
import IAppContext from '@app/context/contracts/app-context.contract';

interface IDependencies {
  actorRepo: IActorRepo;
  actorService: IActorService;
  userIdentityService: IUserIdentityService;
  eventBus: IEventBus;
  appContext: IAppContext;
  userRepo: IUserRepo;
  userAuthRepo: IUserAuthRepo;
  userAuthAppService: IUserAuthAppService;
  repoService: IRepoService;
}

export default function makeLoginWithGoogleUseCase(deps: IDependencies) {
  return async (profile: IOAuthProfile, done: TOAuthDoneCallback) => {
    try {
      if (
        !profile.providerSubject ||
        !profile.email ||
        !profile.emailVerified
      ) {
        const error = new appError.BadRequest();
        return done(error, false);
      }

      const { correlationId, idempotencyKey } = deps.appContext.get();

      const email = emailValue.normalize(profile.email);
      const existingUser = await deps.userRepo.findByEmail(email, {
        correlationId,
      });

      if (existingUser) {
        await deps.actorService.resolveUser(existingUser, { correlationId });
        await deps.repoService.runInTransaction(async (tx) => {
          const userAuth = await deps.userAuthRepo.findByUserId(
            existingUser.id,
            {
              correlationId,
              tx,
            }
          );

          if (!userAuth) {
            throw new authError.InconsistentUserAuth();
          }

          if (!userAuth.strategy.includes(EAuthStrategy.Google)) {
            const updatedUserAuth = deps.userAuthAppService.addStrategy(
              userAuth,
              EAuthStrategy.Google
            );

            await deps.userAuthRepo.update(updatedUserAuth, {
              correlationId,
              expectedVersion: userAuth.version,
              tx,
            });
          }
        });

        return done(null, existingUser);
      }

      const identity = deps.userIdentityService.create({
        firstName: profile.firstName,
        lastName: profile.lastName,
        email,
        emailVerified: true,
      });

      const [actor, actorEvents, actorAudit] = identity.actor;
      const [user, userEvents, userAuditDelta] = identity.user;
      const actorHistory = historyValue.make(
        actorAudit,
        actor.id,
        correlationId
      );

      const history = historyValue.make(
        userAuditDelta,
        user.actorId,
        correlationId
      );

      const userAuth = deps.userAuthAppService.make({
        userId: user.id,
        createdBy: actor.id,
        password: null,
        strategy: EAuthStrategy.Google,
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

      return done(null, user);
    } catch (error) {
      if (error instanceof Error) {
        return done(error, false);
      }
      return done(new appError.InternalServerError(), false);
    }
  };
}
