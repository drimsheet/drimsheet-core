import IPdfService from '@shared/contracts/pdf.service.contract';
import generateUUID from '@shared/utils/uuid-generator';
import appError from '@shared/values/errors/app.error';
import { EFileAttachmentType } from '@shared/values/file-attachments/types/file-attachment.types';

import mockAgentRunContextRepo from '@app/ai/contracts/repos/__mocks__/agent-run-context.repo.mock';
import mockAgentContextAppService from '@app/ai/contracts/services/__mocks__/agent-context.service.mock';
import agentContextAppError from '@app/ai/errors/agent-context.error';
import makeProposeJournalEntriesUsecase from '@app/ai/usecases/propose-journal-entries.usecase';
import mockFileStorageClient from '@app/file/contracts/clients/__mocks__/file-storage-client.mock';

type TDependencies = Parameters<typeof makeProposeJournalEntriesUsecase>[0];

describe('propose journal entries use case', () => {
  const journalEntryProposalsRepo: jest.Mocked<
    TDependencies['journalEntryProposalsRepo']
  > = { save: jest.fn() };
  const structuredLlmCall: jest.MockedFunction<
    TDependencies['structuredLlmCall']
  > = jest.fn();
  const pdfService: jest.Mocked<IPdfService> = { convertToText: jest.fn() };
  const proposeJournalEntries = makeProposeJournalEntriesUsecase({
    agentRunContextRepo: mockAgentRunContextRepo,
    agentContextAppService: mockAgentContextAppService,
    journalEntryProposalsRepo,
    fileStorageClient: mockFileStorageClient,
    pdfService,
    structuredLlmCall,
  });
  const contextId = generateUUID();
  const file = {
    url: 'https://example.com/receipt.png',
    name: 'receipt.png',
    type: EFileAttachmentType.Png,
    size: 1024,
  };
  const proposals = { ledgerAccounts: [], counterparties: [], entries: [] };

  const runContext = {
    id: contextId,
    accountingEntityId: generateUUID(),
    correlationId: generateUUID(),
    agentActor: { id: generateUUID(), name: 'Drimsheet AI' },
    delegatingActor: { actorId: generateUUID(), name: 'Uploader' },
    initiatedOn: new Date(),
    completedOn: null,
  };
  const repoOptions = {
    contextId,
    accountingEntityId: runContext.accountingEntityId,
    correlationId: runContext.correlationId,
    agentActor: runContext.agentActor,
    delegatingActor: {
      id: runContext.delegatingActor.actorId,
      name: 'Uploader',
    },
  };

  beforeEach(() => {
    jest.resetAllMocks();
    mockAgentRunContextRepo.findById.mockResolvedValue(runContext);
    mockAgentContextAppService.getAgentRepoOptions.mockReturnValue(repoOptions);
    structuredLlmCall.mockResolvedValue(proposals);
    journalEntryProposalsRepo.save.mockResolvedValue(undefined);
  });

  it('extracts, saves and returns proposals for the run', async () => {
    const extraction = { ...proposals, sourceFile: file };

    await expect(proposeJournalEntries(file, contextId)).resolves.toEqual(
      extraction
    );
    expect(mockAgentRunContextRepo.findById).toHaveBeenCalledWith(contextId);
    expect(structuredLlmCall).toHaveBeenCalledWith(file);
    expect(pdfService.convertToText).not.toHaveBeenCalled();
    expect(mockAgentContextAppService.getAgentRepoOptions).toHaveBeenCalledWith(
      runContext
    );
    expect(journalEntryProposalsRepo.save).toHaveBeenCalledWith(
      extraction,
      repoOptions
    );
  });

  it('extracts from PDF text and saves the original PDF attachment', async () => {
    const pdf = {
      ...file,
      url: 'https://example.com/receipt.pdf',
      name: 'receipt.pdf',
      type: EFileAttachmentType.Pdf,
    };
    const downloadUrl = 'https://example.com/receipt.pdf?signature=test';
    const pdfText = 'Receipt total: 100 NGN';
    const extraction = { ...proposals, sourceFile: pdf };
    mockFileStorageClient.getDownloadUrl.mockResolvedValue(downloadUrl);
    pdfService.convertToText.mockResolvedValue(pdfText);

    await expect(proposeJournalEntries(pdf, contextId)).resolves.toEqual(
      extraction
    );

    expect(mockFileStorageClient.getDownloadUrl).toHaveBeenCalledWith(pdf.url);
    expect(pdfService.convertToText).toHaveBeenCalledWith(downloadUrl);
    expect(structuredLlmCall).toHaveBeenCalledWith(pdfText);
    expect(journalEntryProposalsRepo.save).toHaveBeenCalledWith(
      extraction,
      repoOptions
    );
  });

  it('rejects an invalid file before looking up the run context', async () => {
    const invalidFile = { ...file, size: 0 };

    await expect(
      proposeJournalEntries(invalidFile, contextId)
    ).rejects.toBeInstanceOf(appError.UnprocessableEntity);
    expect(mockAgentRunContextRepo.findById).not.toHaveBeenCalled();
  });

  it('rejects a missing run context before extracting proposals', async () => {
    mockAgentRunContextRepo.findById.mockResolvedValue(null);

    await expect(proposeJournalEntries(file, contextId)).rejects.toBeInstanceOf(
      agentContextAppError.NotFound
    );
    expect(structuredLlmCall).not.toHaveBeenCalled();
    expect(journalEntryProposalsRepo.save).not.toHaveBeenCalled();
  });

  it('propagates proposer failures without saving an extraction', async () => {
    const failure = new Error('Could not extract proposals');
    structuredLlmCall.mockRejectedValue(failure);

    await expect(proposeJournalEntries(file, contextId)).rejects.toBe(failure);
    expect(journalEntryProposalsRepo.save).not.toHaveBeenCalled();
  });
});
