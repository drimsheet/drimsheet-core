import IAppContextService from '@shared/contracts/app-context.service.contract';

import { IAppContextData } from '@app/context/types/app-context.types';
import ITransactionalEmailQueue from '@app/notification/contracts/transactional-email-queue.contract';
import ITransactionalEmailAppService from '@app/notification/contracts/transactional-email-service.contract';
import ITransactionalEmailTemplate from '@app/notification/contracts/transactional-email-template.contract';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  transactionalEmailQueue: ITransactionalEmailQueue;
  transactionalEmailTemplate: ITransactionalEmailTemplate;
}

/** Renders and queues verification mail; renderer and queue failures reject. */
function makeSendEmailVerification(
  deps: IDependencies
): ITransactionalEmailAppService['sendEmailVerification'] {
  return async (payload) => {
    const { user, verificationLink } = payload;
    const { correlationId } = deps.appContext.get();

    await deps.transactionalEmailQueue.add(correlationId, {
      emails: [user.email],
      subject: 'Action Required: Verify Your Email Address',
      html: deps.transactionalEmailTemplate.emailVerification({
        firstName: user.firstName,
        verificationLink,
      }),
    });
  };
}

/** Renders and queues reset mail; renderer and queue failures reject. */
function makeSendPasswordResetLink(
  deps: IDependencies
): ITransactionalEmailAppService['sendPasswordResetLink'] {
  return async (payload) => {
    const { user, resetLink } = payload;
    const { correlationId } = deps.appContext.get();

    await deps.transactionalEmailQueue.add(correlationId, {
      emails: [user.email],
      subject: 'Reset your password',
      html: deps.transactionalEmailTemplate.passwordResetRequest({
        subject: 'Password Reset Request',
        firstName: escapeHtml(user.firstName),
        passwordResetLink: resetLink,
      }),
    });
  };
}

export default function makeTransactionalEmailAppService(
  deps: IDependencies
): ITransactionalEmailAppService {
  return Object.freeze({
    sendEmailVerification: makeSendEmailVerification(deps),
    sendPasswordResetLink: makeSendPasswordResetLink(deps),
  });
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character]!
  );
}
