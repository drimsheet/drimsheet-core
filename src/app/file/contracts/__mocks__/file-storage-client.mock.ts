import IFileStorageClient from '@app/file/contracts/file-storage-client.contract';

const mockFileStorageClient: jest.Mocked<IFileStorageClient> = {
  preSignUpload: jest.fn(),
  getDownloadUrl: jest.fn(),
  readFile: jest.fn(),
  deleteFile: jest.fn(),
};

export default mockFileStorageClient;
