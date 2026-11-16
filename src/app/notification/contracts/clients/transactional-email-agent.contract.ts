import { ITransactionalEmailDto } from '@app/notification/dtos/transactional-email/transactional-email.dto';

export enum ETransactionalEmailAgent {
  Notifications = 'notifications',
  Osahon = 'osahon',
  NoReply = 'noReply',
}

export default interface ITransactionalEmailAgent {
  send(payload: ITransactionalEmailDto): Promise<void>;
}

export interface IInternalMailer extends ITransactionalEmailAgent {
  send(payload: ITransactionalEmailDto): Promise<void>;
  getEmail(email: string, subject: string): ITransactionalEmailDto | null;
}
