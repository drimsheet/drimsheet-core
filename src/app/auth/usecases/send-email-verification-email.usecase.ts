import { z } from 'zod';

import ILogger from '@shared/contracts/logger.contract';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import IUserRepo from '@domain/user/repos/user.repo';
import emailValue from '@domain/user/values/email.vo';

import IEmailVerificationAppService from '@app/auth/contracts/email-verification-service.contract';
import authError from '@app/auth/errors/auth.error';
import IAppContext from '@app/context/contracts/app-context.contract';

const validationSchema = z.object({
  email: z.email(),
});

interface IDependencies {
  appContext: IAppContext;
  logger: ILogger;
  userRepo: IUserRepo;
  emailVerificationAppService: IEmailVerificationAppService;
}

export default function makeSendEmailVerificationEmailUseCase(
  deps: IDependencies
) {
  return async (userEmail: string) => {
    zodValidationRunner(validationSchema, { email: userEmail });

    const { correlationId } = deps.appContext.get();

    const user = await deps.userRepo.findByEmail(
      emailValue.normalize(userEmail),
      {
        correlationId,
      }
    );

    if (!user) {
      throw new authError.UserNotFound();
    }

    if (user.emailVerified) {
      deps.logger.info('auth.email_verification.skipped', {
        message:
          'Skipping email verification because the user is already verified',
        outcome: 'skipped',
      });
      return;
    }

    await deps.emailVerificationAppService.send(user, correlationId);
  };
}
