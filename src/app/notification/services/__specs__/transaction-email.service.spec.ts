import { TEntityId } from '@shared/types/uuid';

import { IUser } from '@domain/user/types/user.types';

import mockTransactionalEmailTemplate from '@app/notification/contracts/__mocks__/transactional-email-template.mock';
import ITransactionalEmailQueue from '@app/notification/contracts/transactional-email-queue.contract';
import makeTransactionalEmailAppService from '@app/notification/services/transaction-email.service';

describe('transactionEmailAppService', () => {
  const verificationEmailHtml = '<html>verification email</html>';
  const passwordResetEmailHtml = '<html>password reset email</html>';
  const mockQueue: jest.Mocked<ITransactionalEmailQueue> = {
    add: jest.fn(),
  };
  let service: ReturnType<typeof makeTransactionalEmailAppService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransactionalEmailTemplate.emailVerification.mockReturnValue(
      verificationEmailHtml
    );
    mockTransactionalEmailTemplate.passwordResetRequest.mockReturnValue(
      passwordResetEmailHtml
    );

    service = makeTransactionalEmailAppService({
      transactionalEmailQueue: mockQueue,
      transactionalEmailTemplate: mockTransactionalEmailTemplate,
    });
  });

  describe('sendEmailVerification', () => {
    it('adds verification email to the queue', async () => {
      const user = makeUser({
        email: 'alice@example.com',
        firstName: 'Alice',
      });
      const payload = {
        correlationId: 'corr-id-1',
        user,
        verificationLink: 'https://example.com/verify',
      };

      await service.sendEmailVerification(payload);

      expect(
        mockTransactionalEmailTemplate.emailVerification
      ).toHaveBeenCalledTimes(1);
      expect(
        mockTransactionalEmailTemplate.emailVerification
      ).toHaveBeenCalledWith({
        firstName: 'Alice',
        verificationLink: 'https://example.com/verify',
      });
      expect(
        mockTransactionalEmailTemplate.passwordResetRequest
      ).not.toHaveBeenCalled();
      expect(mockQueue.add).toHaveBeenCalledTimes(1);
      expect(mockQueue.add).toHaveBeenCalledWith({
        emails: ['alice@example.com'],
        subject: 'Action Required: Verify Your Email Address',
        html: verificationEmailHtml,
        correlationId: 'corr-id-1',
      });
    });

    it('propagates renderer failures without queueing an email', async () => {
      const rendererError = new Error('renderer failed');
      mockTransactionalEmailTemplate.emailVerification.mockImplementationOnce(
        () => {
          throw rendererError;
        }
      );

      await expect(
        service.sendEmailVerification({
          correlationId: 'corr-id-1',
          user: makeUser({
            email: 'alice@example.com',
            firstName: 'Alice',
          }),
          verificationLink: 'https://example.com/verify',
        })
      ).rejects.toBe(rendererError);

      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('sendPasswordResetLink', () => {
    it('adds password reset email to the queue and escapes user first name', async () => {
      const user = makeUser({
        email: 'bob@example.com',
        firstName: '<Bob>&"\'',
      });
      const payload = {
        correlationId: 'corr-id-2',
        user,
        resetLink: 'https://example.com/reset',
      };

      await service.sendPasswordResetLink(payload);

      expect(
        mockTransactionalEmailTemplate.passwordResetRequest
      ).toHaveBeenCalledTimes(1);
      expect(
        mockTransactionalEmailTemplate.passwordResetRequest
      ).toHaveBeenCalledWith({
        subject: 'Password Reset Request',
        firstName: '&lt;Bob&gt;&amp;&quot;&#39;',
        passwordResetLink: 'https://example.com/reset',
      });
      expect(
        mockTransactionalEmailTemplate.emailVerification
      ).not.toHaveBeenCalled();
      expect(mockQueue.add).toHaveBeenCalledTimes(1);
      expect(mockQueue.add).toHaveBeenCalledWith({
        emails: ['bob@example.com'],
        subject: 'Reset your password',
        html: passwordResetEmailHtml,
        correlationId: 'corr-id-2',
      });
    });

    it('propagates queue failures', async () => {
      const queueError = new Error('queue failed');
      mockQueue.add.mockRejectedValueOnce(queueError);

      await expect(
        service.sendPasswordResetLink({
          correlationId: 'corr-id-2',
          user: makeUser({
            email: 'bob@example.com',
            firstName: 'Bob',
          }),
          resetLink: 'https://example.com/reset',
        })
      ).rejects.toBe(queueError);
    });
  });
});

function makeUser({
  email,
  firstName,
}: Pick<IUser, 'email' | 'firstName'>): IUser {
  const timestamp = new Date('2026-01-01T00:00:00.000Z');

  return {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: '00000000-0000-0000-0000-000000000001' as TEntityId,
    version: 1,
    email,
    emailVerified: false,
    firstName,
    lastName: 'Test',
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  };
}
