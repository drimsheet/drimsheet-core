import IPasswordAppService from '@app/auth/contracts/password-service.contract';

const mockPasswordAppService: jest.Mocked<IPasswordAppService> = {
  makePassword: jest.fn(),
  hash: jest.fn(),
  compare: jest.fn(),
};

export default mockPasswordAppService;
