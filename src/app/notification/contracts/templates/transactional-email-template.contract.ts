export interface IEmailVerificationTemplateParams {
  firstName: string;
  verificationLink: string;
}

export interface IPasswordResetRequestTemplateParams {
  subject: string;
  firstName: string;
  passwordResetLink: string;
}

export default interface ITransactionalEmailTemplate {
  emailVerification(params: IEmailVerificationTemplateParams): string;
  passwordResetRequest(params: IPasswordResetRequestTemplateParams): string;
}
