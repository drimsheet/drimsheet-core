import appError from '@shared/values/errors/app.error';

import mockTransactionalEmailAgent from '@app/notification/contracts/__mocks__/transactional-email-agent.mock';
import { ITransactionalEmailDto } from '@app/notification/dtos/transactional-email/transactional-email.dto';
import makeTransactionalEmailWorker from '@app/notification/workers/transactional-email.worker';

describe('makeTransactionalEmailWorker', () => {
  const payload: ITransactionalEmailDto = {
    emails: ['recipient@example.com'],
    subject: 'Transaction update',
    html: '<p>Transaction update</p>',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('validates and sends a transactional email', async () => {
    mockTransactionalEmailAgent.send.mockResolvedValue(undefined);
    const worker = makeTransactionalEmailWorker({
      mailer: mockTransactionalEmailAgent,
    });

    await worker(payload);

    expect(mockTransactionalEmailAgent.send).toHaveBeenCalledWith(payload);
  });

  it('rejects invalid payloads before sending', async () => {
    const worker = makeTransactionalEmailWorker({
      mailer: mockTransactionalEmailAgent,
    });

    await expect(
      worker({ ...payload, emails: ['not-an-email'] })
    ).rejects.toBeInstanceOf(appError.UnprocessableEntity);
    expect(mockTransactionalEmailAgent.send).not.toHaveBeenCalled();
  });

  it('propagates mailer failures', async () => {
    const mailerError = new Error('mailer failed');
    mockTransactionalEmailAgent.send.mockRejectedValue(mailerError);
    const worker = makeTransactionalEmailWorker({
      mailer: mockTransactionalEmailAgent,
    });

    await expect(worker(payload)).rejects.toBe(mailerError);
  });
});
