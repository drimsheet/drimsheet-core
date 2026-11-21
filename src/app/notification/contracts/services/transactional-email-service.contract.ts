import { IUser } from '@domain/user/types/user.types';

interface IEmailVerificationPayload {
  user: IUser;
  verificationLink: string;
}

interface IPasswordResetPayload {
  user: IUser;
  resetLink: string;
}

export default interface ITransactionalEmailAppService {
  /** Uses app-context correlation; renderer and enqueue failures reject. */
  sendEmailVerification(payload: IEmailVerificationPayload): Promise<void>;
  /** Uses app-context correlation; renderer and enqueue failures reject. */
  sendPasswordResetLink(payload: IPasswordResetPayload): Promise<void>;
}
