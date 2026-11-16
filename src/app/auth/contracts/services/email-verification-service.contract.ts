import { IUser } from '@domain/user/types/user.types';

export default interface IEmailVerificationAppService {
  send(user: IUser, correlationId: string): Promise<boolean>;
}
