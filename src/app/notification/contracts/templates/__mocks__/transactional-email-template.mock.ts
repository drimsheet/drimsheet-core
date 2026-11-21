import ITransactionalEmailTemplate from '@app/notification/contracts/templates/transactional-email-template.contract';

const mockTransactionalEmailTemplate: jest.Mocked<ITransactionalEmailTemplate> =
  {
    emailVerification: jest.fn(),
    passwordResetRequest: jest.fn(),
  };

export default mockTransactionalEmailTemplate;
