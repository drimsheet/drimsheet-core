import { ICacheStorage } from '@shared/contracts/cache-storage.contract';
import IVarsConfig from '@shared/contracts/vars-config.contract';

import IEmailVerificationAppService from '@app/auth/contracts/email-verification-service.contract';
import ITokenAppService from '@app/auth/contracts/token-service.contract';
import ITransactionalEmailAppService from '@app/notification/contracts/transactional-email-service.contract';

export const EMAIL_VERIFICATION_COOL_DOWN_SECONDS = 60;

interface IDependencies {
  cacheStorage: ICacheStorage;
  tokenAppService: ITokenAppService;
  transactionalEmailAppService: ITransactionalEmailAppService;
  varsConfig: IVarsConfig;
}

function getCoolDownKey(userId: string): string {
  return `app:auth:email-verification-cooldown:${userId}`;
}

/**
 * Creates the capability that acquires the verification cooldown and sends
 * the email, releasing the cooldown when token generation or delivery fails.
 */
function makeSend(deps: IDependencies): IEmailVerificationAppService['send'] {
  return async (user, correlationId) => {
    const coolDownKey = getCoolDownKey(user.id);
    const acquired = await deps.cacheStorage.setIfNotExists(
      coolDownKey,
      true,
      EMAIL_VERIFICATION_COOL_DOWN_SECONDS
    );

    if (!acquired) return false;

    try {
      const verificationToken = await deps.tokenAppService.generateSignupToken({
        id: user.id,
      });
      const verificationLink = `${deps.varsConfig.WEB_APP_URL}/auth/signup/complete?token=${verificationToken}`;

      await deps.transactionalEmailAppService.sendEmailVerification({
        user,
        verificationLink,
        correlationId,
      });

      return true;
    } catch (error) {
      await deps.cacheStorage.del(coolDownKey);
      throw error;
    }
  };
}

/** Composes the immutable email-verification service from its capability. */
export default function makeEmailVerificationAppService(deps: IDependencies) {
  const service: IEmailVerificationAppService = {
    send: makeSend(deps),
  };

  return Object.freeze(service);
}
