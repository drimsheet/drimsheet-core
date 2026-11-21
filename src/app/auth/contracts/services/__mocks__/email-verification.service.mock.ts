import IEmailVerificationAppService from '@app/auth/contracts/services/email-verification-service.contract';

const mockEmailVerificationAppService: jest.Mocked<IEmailVerificationAppService> =
  {
    send: jest.fn(),
  };

export default mockEmailVerificationAppService;
