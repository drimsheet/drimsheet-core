import IPasswordAppService from '@app/auth/contracts/services/password-service.contract';

const mockPasswordAppService: jest.Mocked<IPasswordAppService> = {
  makePassword: jest.fn(),
  hash: jest.fn(),
  compare: jest.fn(),
};

export default mockPasswordAppService;
