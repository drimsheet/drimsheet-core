/**
 * SUMMARY
 * Requests a verification email for an existing unverified user. Rejects an
 * unknown email and skips users whose email is already verified. Delivery is
 * subject to the verification cooldown and may be suppressed; delivery failures
 * propagate. Returns no value, including when delivery is skipped.
 *
 * WHEN TO USE
 * Use to resend verification instructions for an existing account before the
 * user completes email verification.
 *
 * SEQUENCE DIAGRAM
 * Not required for this straightforward workflow.
 */

import { z } from 'zod';

import IAppContextService from '@shared/contracts/app-context.service.contract';
import ILogger from '@shared/contracts/logger.contract';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import IUserRepo from '@domain/user/repos/user.repo';
import emailValue from '@domain/user/values/email.vo';

import IEmailVerificationAppService from '@app/auth/contracts/email-verification-service.contract';
import authError from '@app/auth/errors/auth.error';
import { IAppContextData } from '@app/context/types/app-context.types';

const validationSchema = z.object({
  email: z.email(),
});

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
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
