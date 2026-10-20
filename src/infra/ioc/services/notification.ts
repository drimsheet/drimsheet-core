import makeTransactionalEmailAppService from '@app/notification/services/transaction-email.service';

import messaging from '@infra/messaging';
import appContext from '@infra/services/app-context.service';
import transactionalEmailTemplate from '@infra/templates/email/transactional-email-template.impl';

export const transactionalEmailAppService = makeTransactionalEmailAppService({
  appContext,
  transactionalEmailQueue: messaging.queues.transactionalEmail,
  transactionalEmailTemplate,
});
