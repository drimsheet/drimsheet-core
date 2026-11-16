import ITransactionalEmailTemplate from '@app/notification/contracts/templates/transactional-email-template.contract';

import emailVerificationEmailTemplate from './email-verification-email';
import passwordResetRequestEmailTemplate from './password-reset-request-email';

const transactionalEmailTemplate: ITransactionalEmailTemplate = Object.freeze({
  emailVerification: emailVerificationEmailTemplate,
  passwordResetRequest: passwordResetRequestEmailTemplate,
});

export default transactionalEmailTemplate;
