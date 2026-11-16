import IFileManagementAppService from '@app/file/contracts/services/file-management.service.contract';

const mockFileManagementAppService: jest.Mocked<IFileManagementAppService> = {
  preSignUploads: jest.fn(),
  claimUploads: jest.fn(),
  getDownloadUrl: jest.fn(),
};

export default mockFileManagementAppService;
