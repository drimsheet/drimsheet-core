import IPdfService from '@shared/contracts/pdf.service.contract';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';
import appError from '@shared/values/errors/app.error';
import { EFileAttachmentType } from '@shared/values/file-attachments/types/file-attachment.types';

import { IActor } from '@domain/user/types/actor.types';

import mockAgentContextAppService from '@app/ai/contracts/__mocks__/agent-context.service.mock';
import mockJournalEntryExtractionQueue from '@app/ai/contracts/queues/__mocks__/journal-entry-extraction-queue.mock';
import { IAgentRunContext } from '@app/ai/types/agent-run-context.types';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import mockFileStorageClient from '@app/file/contracts/clients/__mocks__/file-storage-client.mock';
import fileAppError from '@app/file/errors/file.error';
import makeFileManagementAppService from '@app/file/services/file-management.service';
import { IInitiateJournalEntryExtractionReq } from '@app/journal-entry/dtos/initiate-journal-entry-extraction/initiate-journal-entry-extraction.dto';
import makeInitiateJournalEntryExtractionUsecase from '@app/journal-entry/usecases/initiate-journal-entry-extraction.usecase';

describe('initiateJournalEntryExtractionUsecase', () => {
  const agentRunContext: IAgentRunContext = {
    id: generateUUID(),
    accountingEntityId: generateUUID(),
    correlationId: generateUUID(),
    agentActor: { id: generateUUID(), name: 'Drimsheet AI' },
    delegatingActor: { actorId: generateUUID(), name: 'Uploader' },
    initiatedOn: new Date('2026-11-20T10:00:00Z'),
    completedOn: null,
  };

  const expectedContext = {
    ...agentRunContext,
    initiatedOn: '2026-11-20T10:00:00.000Z',
    completedOn: null,
  };

  const userId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  const actorId = agentRunContext.delegatingActor.actorId as TEntityId;
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
  const payload: IInitiateJournalEntryExtractionReq = {
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
  const downloadUrl = 'https://example.com/receipt?signature=test';
  const pdfService: jest.Mocked<IPdfService> = {
    convertToText: jest.fn(),
  };
  const usecase = makeInitiateJournalEntryExtractionUsecase({
    agentContextAppService: mockAgentContextAppService,
    appContext: mockAppContext,
    fileStorageClient: mockFileStorageClient,
    pdfService,
    fileManagementAppService: makeFileManagementAppService({
      fileStorageClient: mockFileStorageClient,
    }),
    journalEntryExtractionQueue: mockJournalEntryExtractionQueue,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      correlationId: agentRunContext.correlationId,
      user: { id: userId },
      actor,
      accountingEntity: { id: agentRunContext.accountingEntityId },
    });
    mockFileStorageClient.getFileKey.mockReturnValue(key);
    mockFileStorageClient.readFile.mockResolvedValue(storedFile);
    mockFileStorageClient.getDownloadUrl.mockResolvedValue(downloadUrl);
    mockAgentContextAppService.createRunContext.mockResolvedValue(
      agentRunContext
    );
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
      expect(pdfService.convertToText).not.toHaveBeenCalled();
      expect(mockAgentContextAppService.createRunContext).toHaveBeenCalledWith(
        {
          accountingEntityId: agentRunContext.accountingEntityId,
          correlationId: agentRunContext.correlationId,
          agentActorUsername: 'drimsheet-core-ai',
          delegatingActorUsername: actor.username,
          initiatedOn: expect.any(Date),
        },
        { correlationId: agentRunContext.correlationId }
      );
      expect(mockJournalEntryExtractionQueue.add).toHaveBeenCalledWith({
        value: {
          url: storedFile.fileUrl,
          name: 'receipt.png',
          type: EFileAttachmentType.Png,
          size: storedFile.size,
        },
        context: expectedContext,
      });
    }
  );

  it('enqueues extracted text for a PDF upload', async () => {
    const fileUrl = 'https://example.com/receipt.pdf';
    const pdfText = 'Receipt total: 100 NGN';
    mockFileStorageClient.readFile.mockResolvedValue({
      ...storedFile,
      fileUrl,
      contentType: 'application/pdf',
      metadata: {
        'original-name': Buffer.from('receipt.pdf').toString('base64url'),
      },
      data: Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d]),
    });
    pdfService.convertToText.mockResolvedValue(pdfText);

    await usecase(payload);

    expect(mockFileStorageClient.getDownloadUrl).toHaveBeenCalledWith(fileUrl);
    expect(pdfService.convertToText).toHaveBeenCalledWith(downloadUrl);
    expect(mockJournalEntryExtractionQueue.add).toHaveBeenCalledWith({
      value: pdfText,
      context: expectedContext,
    });
  });

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
        usecase(invalidPayload as IInitiateJournalEntryExtractionReq)
      ).rejects.toThrow(appError.UnprocessableEntity);
      expect(mockFileStorageClient.readFile).not.toHaveBeenCalled();
      expect(mockJournalEntryExtractionQueue.add).not.toHaveBeenCalled();
    }
  );
});
