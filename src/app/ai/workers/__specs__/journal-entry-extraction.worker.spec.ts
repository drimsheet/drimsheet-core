import generateUUID from '@shared/utils/uuid-generator';
import appError from '@shared/values/errors/app.error';
import { EFileAttachmentType } from '@shared/values/file-attachments/types/file-attachment.types';

import makeJournalEntryExtractionWorker from '@app/ai/workers/journal-entry-extraction.worker';

type TDependencies = Parameters<typeof makeJournalEntryExtractionWorker>[0];

describe('makeJournalEntryExtractionWorker', () => {
  const context = {
    accountingEntityId: generateUUID(),
    correlationId: generateUUID(),
    delegatingActorId: generateUUID(),
  };
  const runContext = {
    id: generateUUID(),
    accountingEntityId: context.accountingEntityId,
    correlationId: context.correlationId,
    agentActor: { id: generateUUID(), name: 'Drimsheet AI' },
    delegatingActor: { actorId: context.delegatingActorId, name: 'Uploader' },
    initiatedOn: new Date('2026-11-20T10:00:00.000Z'),
    completedOn: null,
  };

  const file = {
    url: 'https://example.com/receipt.png',
    name: 'receipt.png',
    type: EFileAttachmentType.Png,
    size: 1024,
  };
  const createAgentRunContextUseCase: jest.MockedFunction<
    TDependencies['createAgentRunContextUseCase']
  > = jest.fn();
  const proposeJournalEntriesUseCase: jest.MockedFunction<
    TDependencies['proposeJournalEntriesUseCase']
  > = jest.fn();
  const worker = makeJournalEntryExtractionWorker({
    createAgentRunContextUseCase,
    proposeJournalEntriesUseCase,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    createAgentRunContextUseCase.mockResolvedValue(runContext);
  });

  it('passes the original file and generated run context ID to the use case', async () => {
    await worker({ ...context, file });

    expect(createAgentRunContextUseCase).toHaveBeenCalledWith({
      ...context,
      agentActorUsername: 'drimsheet-core-ai',
    });
    expect(proposeJournalEntriesUseCase).toHaveBeenCalledWith(
      file,
      runContext.id
    );
  });

  it('rejects invalid jobs', async () => {
    await expect(
      worker({ ...context, file: { ...file, size: 0 } })
    ).rejects.toBeInstanceOf(appError.UnprocessableEntity);
    expect(createAgentRunContextUseCase).not.toHaveBeenCalled();
  });

  it('propagates failures from context creation', async () => {
    const failure = new Error('Could not create run context');
    createAgentRunContextUseCase.mockRejectedValue(failure);

    await expect(worker({ ...context, file })).rejects.toBe(failure);
    expect(proposeJournalEntriesUseCase).not.toHaveBeenCalled();
  });

  it('propagates extraction use-case failures', async () => {
    const failure = new Error('Could not extract proposals');
    proposeJournalEntriesUseCase.mockRejectedValue(failure);

    await expect(worker({ ...context, file })).rejects.toBe(failure);
  });
});
