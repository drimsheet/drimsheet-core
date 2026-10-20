import axios from 'axios';

import { ITransactionalEmailDto } from '@app/notification/dtos/transactional-email/transactional-email.dto';

import zeptoMail from '@infra/integrations/zeptomail/zeptomail-email-agent';

jest.mock('axios', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

jest.mock('@infra/config/vars.config', () => ({
  __esModule: true,
  default: {
    ZEPTO_TOKEN_NOTIFICATIONS: 'notifications-token',
    ZEPTO_TOKEN_OSAHON: 'osahon-token',
    ZEPTO_TOKEN_NOREPLY: 'no-reply-token',
  },
}));

const payload: ITransactionalEmailDto = {
  emails: ['ada@example.com', 'grace@example.com'],
  subject: 'Welcome',
  html: '<p>Welcome</p>',
  templateId: 'welcome-template',
  data: { firstName: 'Ada' },
};

describe('ZeptoMail email agent', () => {
  const post = jest.mocked(axios.post);

  beforeEach(() => {
    post.mockReset().mockResolvedValue({});
  });

  it('maps transactional email delivery to the ZeptoMail API', async () => {
    await zeptoMail.notifications.send(payload);

    expect(post).toHaveBeenCalledWith(
      'https://api.zeptomail.com/v1.1/email',
      {
        from: {
          address: 'notifications@drimsheet.com',
          name: 'Team Drimsheet',
        },
        to: [
          { email_address: { address: 'ada@example.com' } },
          { email_address: { address: 'grace@example.com' } },
        ],
        subject: 'Welcome',
        htmlBody: '<p>Welcome</p>',
        mail_template_key: 'welcome-template',
        merge_data: { firstName: 'Ada' },
      },
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: 'notifications-token',
        },
      }
    );
  });

  it.each([
    {
      agent: zeptoMail.osahon,
      address: 'osahon@drimsheet.com',
      name: 'Osahon from Drimsheet',
      token: 'osahon-token',
    },
    {
      agent: zeptoMail.noReply,
      address: 'noreply@drimsheet.com',
      name: 'Team Drimsheet',
      token: 'no-reply-token',
    },
  ])('preserves the $address sender identity', async (sender) => {
    await sender.agent.send(payload);

    expect(post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        from: { address: sender.address, name: sender.name },
      }),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: sender.token }),
      })
    );
  });

  it('propagates ZeptoMail delivery failures', async () => {
    const error = new Error('delivery failed');
    post.mockRejectedValue(error);

    await expect(zeptoMail.notifications.send(payload)).rejects.toBe(error);
  });
});
