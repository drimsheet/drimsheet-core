import ITransactionalEmailAppService from '@app/notification/contracts/services/transactional-email-service.contract';

const mockTransactionalEmailAppService: jest.Mocked<ITransactionalEmailAppService> =
  {
    sendEmailVerification: jest.fn(),
    sendPasswordResetLink: jest.fn(),
  };

export default mockTransactionalEmailAppService;
