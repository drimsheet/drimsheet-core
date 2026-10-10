import IEmailVerificationAppService from '@app/auth/contracts/email-verification-service.contract';

const mockEmailVerificationAppService: jest.Mocked<IEmailVerificationAppService> =
  {
    send: jest.fn(),
  };

export default mockEmailVerificationAppService;
