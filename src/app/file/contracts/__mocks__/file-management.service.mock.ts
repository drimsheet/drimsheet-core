import IFileManagementAppService from '@app/file/contracts/file-management.service.contract';

const mockFileManagementAppService: jest.Mocked<IFileManagementAppService> = {
  preSignUploads: jest.fn(),
  claimUploads: jest.fn(),
};

export default mockFileManagementAppService;
