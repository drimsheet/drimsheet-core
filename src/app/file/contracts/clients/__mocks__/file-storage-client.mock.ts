import IFileStorageClient from '@app/file/contracts/clients/file-storage-client.contract';

const mockFileStorageClient: jest.Mocked<IFileStorageClient> = {
  getFileKey: jest.fn(),
  preSignUpload: jest.fn(),
  getDownloadUrl: jest.fn(),
  readFile: jest.fn(),
  deleteFile: jest.fn(),
};

export default mockFileStorageClient;
