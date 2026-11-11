import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';
import { EFileAttachmentType } from '@shared/values/file-attachments/types/file-attachment.types';

import { IActor } from '@domain/user/types/actor.types';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/types/app-context.types';
import mockFileStorageClient from '@app/file/contracts/__mocks__/file-storage-client.mock';
import fileAppError from '@app/file/errors/file.error';
import makeFileManagementAppService from '@app/file/services/file-management.service';
import mockJournalEntryExtractionQueue from '@app/journal-entry/contracts/__mocks__/journal-entry-extraction-queue.mock';
import { IJournalEntryUploadReq } from '@app/journal-entry/dtos/journal-entry-upload/journal-entry-upload.dto';
import makeUploadJournalEntryFileUsecase from '@app/journal-entry/usecases/upload-journal-entry-file.usecase';

describe('uploadJournalEntryFileUsecase', () => {
  const userId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  const actorId = '123e4567-e89b-12d3-a456-426614174005' as TEntityId;
  const actor: IActor = {
    id: actorId,
    type: 'user',
    username: 'uploader',
    displayName: 'Uploader',
    ownerActorId: null,
    agentName: null,
    status: 'active',
    createdBy: actorId,
    version: 1,
    createdAt: new Date('2026-11-11T00:00:00Z'),
    updatedAt: new Date('2026-11-11T00:00:00Z'),
  };
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
    journalEntryExtractionQueue: mockJournalEntryExtractionQueue,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      correlationId: 'upload-correlation',
      user: { id: userId },
      actor,
      accountingEntity: { id: '123e4567-e89b-12d3-a456-426614174004' },
    } as IAppContextData &
      Required<Pick<IAppContextData, 'user' | 'actor' | 'accountingEntity'>>);
    mockFileStorageClient.readFile.mockResolvedValue(storedFile);
    mockJournalEntryExtractionQueue.add.mockResolvedValue(undefined);
  });

  it.each(['payment', 'receipt', undefined] as const)(
    'claims and enqueues the upload with source type %s',
    async (sourceType) => {
      await expect(
        usecase({ ...payload, sourceType })
      ).resolves.toBeUndefined();
      expect(mockAppContext.get).toHaveBeenCalledWith([
        'user',
        'actor',
        'accountingEntity',
      ]);
      expect(mockFileStorageClient.readFile).toHaveBeenCalledWith({
        key,
        range: { start: 0, end: 11 },
      });
      expect(mockJournalEntryExtractionQueue.add).toHaveBeenCalledWith(
        'upload-correlation',
        {
          accountId: payload.accountId,
          sourceType,
          actorId,
          accountingEntityId: '123e4567-e89b-12d3-a456-426614174004',
          file: {
            url: storedFile.fileUrl,
            name: 'receipt.png',
            type: EFileAttachmentType.Png,
            size: storedFile.size,
          },
        }
      );
    }
  );

  it('rejects a missing upload', async () => {
    mockFileStorageClient.readFile.mockResolvedValue(null);
    await expect(usecase(payload)).rejects.toThrow(
      fileAppError.InvalidUploadReference
    );
    expect(mockJournalEntryExtractionQueue.add).not.toHaveBeenCalled();
  });

  it('rejects when the claimed upload cannot be enqueued', async () => {
    const failure = new Error('queue unavailable');
    mockJournalEntryExtractionQueue.add.mockRejectedValue(failure);

    await expect(usecase(payload)).rejects.toBe(failure);
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
      expect(mockJournalEntryExtractionQueue.add).not.toHaveBeenCalled();
    }
  );
});
