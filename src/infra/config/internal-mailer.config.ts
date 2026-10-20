import { IInternalMailer } from '@app/notification/contracts/transactional-email-agent.contract';
import { ITransactionalEmailDto } from '@app/notification/dtos/transactional-email/transactional-email.dto';

const sentEmails: Map<string, ITransactionalEmailDto> = new Map();

function getKey(emailAddress: string, subject: string) {
  return `${emailAddress}-${subject}`.toLowerCase();
}

async function send(payload: ITransactionalEmailDto) {
  sentEmails.set(getKey(payload.emails[0], payload.subject), {
    ...payload,
  });
}

function getEmail(emailAddress: string, subject: string) {
  return sentEmails.get(getKey(emailAddress, subject)) ?? null;
}

const mailer: IInternalMailer = {
  send,
  getEmail,
};

export default mailer;
