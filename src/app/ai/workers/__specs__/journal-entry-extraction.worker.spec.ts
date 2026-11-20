import generateUUID from '@shared/utils/uuid-generator';
import appError from '@shared/values/errors/app.error';
import { EFileAttachmentType } from '@shared/values/file-attachments/types/file-attachment.types';

import mockAgentContextAppService from '@app/ai/contracts/services/__mocks__/agent-context.service.mock';
import makeJournalEntryExtractionWorker from '@app/ai/workers/journal-entry-extraction.worker';

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
  const pdfText = 'Receipt total: 100 NGN';
  const worker = makeJournalEntryExtractionWorker({
    agentContextAppService: mockAgentContextAppService,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockAgentContextAppService.createRunContext.mockResolvedValue(runContext);
  });

  it.each([pdfText, file])(
    'creates a run context for a valid job with value %j',
    async (value) => {
      await worker({ value, context });

      expect(mockAgentContextAppService.createRunContext).toHaveBeenCalledWith(
        {
          ...context,
          agentActorUsername: 'drimsheet-core-ai',
        },
        { correlationId: context.correlationId }
      );
    }
  );

  it('rejects invalid jobs', async () => {
    await expect(
      worker({ value: { ...file, size: 0 }, context })
    ).rejects.toBeInstanceOf(appError.UnprocessableEntity);
    expect(mockAgentContextAppService.createRunContext).not.toHaveBeenCalled();
  });

  it('propagates failures from context creation', async () => {
    const failure = new Error('Could not create run context');
    mockAgentContextAppService.createRunContext.mockRejectedValue(failure);

    await expect(worker({ value: pdfText, context })).rejects.toBe(failure);
  });
});
