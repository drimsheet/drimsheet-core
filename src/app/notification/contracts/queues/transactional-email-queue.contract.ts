import { ITransactionalEmailDto } from '@app/notification/dtos/transactional-email/transactional-email.dto';

export const TRANSACTIONAL_EMAIL_QUEUE_NAME =
  'transactional-email-queue' as const;

export default interface ITransactionalEmailQueue {
  add(correlationId: string, payload: ITransactionalEmailDto): Promise<void>;
}
