import IEventBus from '@shared/contracts/event-bus.contract';
import IVarsConfig from '@shared/contracts/vars-config.contract';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';

import userEvents from '@domain/user/events/user.events';
import IUserRepo from '@domain/user/repos/user.repo';

import ITokenAppService from '@app/auth/contracts/token-service.contract';
import IUserAuthRepo from '@app/auth/contracts/user-auth.repo.contract';
import { requestPasswordResetReqValidation } from '@app/auth/dtos/auth/auth.dto.validation';
import IAppContext from '@app/context/contracts/app-context.contract';
import ITransactionalEmailAppService from '@app/notification/contracts/transactional-email-service.contract';

interface IDependencies {
  appContext: IAppContext;
  userRepo: IUserRepo;
  tokenAppService: ITokenAppService;
  transactionEmailAppService: ITransactionalEmailAppService;
  eventBus: IEventBus;
  userAuthRepo: IUserAuthRepo;
  varsConfig: IVarsConfig;
}

export default function makeRequestPasswordResetUseCase(deps: IDependencies) {
  return async (userEmail: string) => {
    zodValidationRunner(requestPasswordResetReqValidation, {
      email: userEmail,
    });
    const { correlationId } = deps.appContext.get();

    const normalizedEmail = userEmail.trim().toLowerCase();

    const user = await deps.userRepo.findByEmail(normalizedEmail, {
      correlationId,
    });

    if (!user) {
      return;
    }

    const userAuth = await deps.userAuthRepo.findByUserId(user.id, {
      correlationId,
    });
    if (!userAuth) {
      return;
    }

    const resetToken =
      await deps.tokenAppService.generatePasswordResetToken(user);
    const resetLink = `${deps.varsConfig.WEB_APP_URL}/auth/reset-password?token=${resetToken}`;

    await deps.transactionEmailAppService.sendPasswordResetLink({
      user,
      resetLink,
      correlationId,
    });

    const event = userEvents.requestedPasswordReset(user);

    await deps.eventBus.publish(eventValue.enrich(event, { correlationId }));
  };
}
