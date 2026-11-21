import axios from 'axios';

import ITransactionalEmailAgent from '@app/notification/contracts/clients/transactional-email-agent.contract';
import { ITransactionalEmailDto } from '@app/notification/dtos/transactional-email/transactional-email.dto';

import vars from '@infra/config/vars.config';

interface IEmailSender {
  email: string;
  name: string;
  agent: string;
}

async function sendEmail(
  payload: ITransactionalEmailDto,
  sender: IEmailSender
) {
  await axios.post(
    'https://api.zeptomail.com/v1.1/email',
    {
      from: {
        address: sender.email,
        name: sender.name,
      },
      to: payload.emails.map((email) => ({
        email_address: { address: email },
      })),
      subject: payload.subject,
      htmlBody: payload.html,
      mail_template_key: payload.templateId,
      merge_data: payload.data,
    },
    {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: sender.agent,
      },
    }
  );
}

function createSender(sender: IEmailSender): ITransactionalEmailAgent {
  return {
    async send(payload: ITransactionalEmailDto) {
      await sendEmail(payload, sender);
    },
  };
}

const notifications = createSender({
  email: 'notifications@drimsheet.com',
  name: 'Team Drimsheet',
  agent: vars.ZEPTO_TOKEN_NOTIFICATIONS,
});

const osahon = createSender({
  email: 'osahon@drimsheet.com',
  name: 'Osahon from Drimsheet',
  agent: vars.ZEPTO_TOKEN_OSAHON,
});

const noReply = createSender({
  email: 'noreply@drimsheet.com',
  name: 'Team Drimsheet',
  agent: vars.ZEPTO_TOKEN_NOREPLY,
});

const mailer = {
  notifications,
  osahon,
  noReply,
};

export default mailer;
