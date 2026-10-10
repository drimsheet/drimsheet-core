import ITransactionalEmailQueue from '@app/notification/contracts/transactional-email-queue.contract';
import ITransactionalEmailAppService from '@app/notification/contracts/transactional-email-service.contract';
import ITransactionalEmailTemplate from '@app/notification/contracts/transactional-email-template.contract';

interface IDependencies {
  transactionalEmailQueue: ITransactionalEmailQueue;
  transactionalEmailTemplate: ITransactionalEmailTemplate;
}

export default function makeTransactionalEmailAppService(
  deps: IDependencies
): ITransactionalEmailAppService {
  return {
    async sendEmailVerification(payload) {
      const { correlationId, user, verificationLink } = payload;

      await deps.transactionalEmailQueue.add({
        emails: [user.email],
        subject: 'Action Required: Verify Your Email Address',
        html: deps.transactionalEmailTemplate.emailVerification({
          firstName: user.firstName,
          verificationLink,
        }),
        correlationId,
      });
    },

    async sendPasswordResetLink(payload) {
      const { correlationId, user, resetLink } = payload;

      await deps.transactionalEmailQueue.add({
        emails: [user.email],
        subject: 'Reset your password',
        html: deps.transactionalEmailTemplate.passwordResetRequest({
          subject: 'Password Reset Request',
          firstName: escapeHtml(user.firstName),
          passwordResetLink: resetLink,
        }),
        correlationId,
      });
    },
  };
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
