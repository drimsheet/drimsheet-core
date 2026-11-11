import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/types/app-context.types';
import mockFileStorageClient from '@app/file/contracts/__mocks__/file-storage-client.mock';
import fileAppError from '@app/file/errors/file.error';
import makeFileManagementAppService from '@app/file/services/file-management.service';
import { IJournalEntryUploadReq } from '@app/journal-entry/dtos/journal-entry-upload/journal-entry-upload.dto';
import makeUploadJournalEntryFileUsecase from '@app/journal-entry/usecases/upload-journal-entry-file.usecase';

describe('uploadJournalEntryFileUsecase', () => {
  const userId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  const reference = '123e4567-e89b-12d3-a456-426614174002';
  const key = `${userId}/journal_entry_creation/${reference}`;
  const payload: IJournalEntryUploadReq = {
    reference,
    accountId: '123e4567-e89b-12d3-a456-426614174003',
  };
  const storedFile = {
    fileUrl: 'https://example.com/receipt.png',
    contentType: 'image/png',
    size: 100,
    metadata: {
      'original-name': Buffer.from('receipt.png').toString('base64url'),
    },
    data: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  };
  const usecase = makeUploadJournalEntryFileUsecase({
    appContext: mockAppContext,
    fileManagementAppService: makeFileManagementAppService({
      fileStorageClient: mockFileStorageClient,
    }),
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      user: { id: userId },
      accountingEntity: { id: '123e4567-e89b-12d3-a456-426614174004' },
    } as IAppContextData &
      Required<Pick<IAppContextData, 'user' | 'accountingEntity'>>);
    mockFileStorageClient.readFile.mockResolvedValue(storedFile);
  });

  it.each(['payment', 'receipt', undefined] as const)(
    'claims the upload with source type %s',
    async (sourceType) => {
      await expect(
        usecase({ ...payload, sourceType })
      ).resolves.toBeUndefined();
      expect(mockAppContext.get).toHaveBeenCalledWith([
        'user',
        'accountingEntity',
      ]);
      expect(mockFileStorageClient.readFile).toHaveBeenCalledWith({
        key,
        range: { start: 0, end: 11 },
      });
    }
  );

  it('rejects a missing upload', async () => {
    mockFileStorageClient.readFile.mockResolvedValue(null);
    await expect(usecase(payload)).rejects.toThrow(
      fileAppError.InvalidUploadReference
    );
  });

  it('accepts an upload at the 15 MiB limit', async () => {
    mockFileStorageClient.readFile.mockResolvedValue({
      ...storedFile,
      size: 15 * 1024 * 1024,
    });

    await expect(usecase(payload)).resolves.toBeUndefined();
    expect(mockFileStorageClient.deleteFile).not.toHaveBeenCalled();
  });

  it('rejects an upload one byte above the 15 MiB limit', async () => {
    mockFileStorageClient.readFile.mockResolvedValue({
      ...storedFile,
      size: 15 * 1024 * 1024 + 1,
    });
    await expect(usecase(payload)).rejects.toThrow(
      fileAppError.InvalidUploadSize
    );
  });

  it('validates actual file signatures', async () => {
    mockFileStorageClient.readFile.mockResolvedValue({
      ...storedFile,
      data: Uint8Array.from([0]),
    });
    await expect(usecase(payload)).rejects.toThrow(
      fileAppError.InvalidUploadType
    );
  });

  it.each([
    { ...payload, reference: 'invalid' },
    { ...payload, reference: undefined },
    { ...payload, reference: null },
    { ...payload, reference: storedFile.fileUrl },
    { ...payload, accountId: 'invalid' },
    { ...payload, sourceType: 'invalid' },
    { ...payload, sourceType: null },
  ])(
    'rejects invalid DTO fields before accessing storage',
    async (invalidPayload) => {
      await expect(
        usecase(invalidPayload as IJournalEntryUploadReq)
      ).rejects.toThrow(appError.UnprocessableEntity);
      expect(mockFileStorageClient.readFile).not.toHaveBeenCalled();
    }
  );
});
