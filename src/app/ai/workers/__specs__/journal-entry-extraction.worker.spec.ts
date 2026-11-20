import generateUUID from '@shared/utils/uuid-generator';
import appError from '@shared/values/errors/app.error';
import { EFileAttachmentType } from '@shared/values/file-attachments/types/file-attachment.types';

import { IAgentRunContextDto } from '@app/ai/dtos/agent-run-context/agent-run-context.dto';
import makeJournalEntryExtractionWorker from '@app/ai/workers/journal-entry-extraction.worker';

describe('makeJournalEntryExtractionWorker', () => {
  const context: IAgentRunContextDto = {
    id: generateUUID(),
    accountingEntityId: generateUUID(),
    correlationId: generateUUID(),
    agentActor: { id: generateUUID(), name: 'Drimsheet AI' },
    delegatingActor: { actorId: generateUUID(), name: 'Uploader' },
    initiatedOn: '2026-11-20T10:00:00.000Z',
    completedOn: null,
  };

  const file = {
    url: 'https://example.com/receipt.png',
    name: 'receipt.png',
    type: EFileAttachmentType.Png,
    size: 1024,
  };
  const pdfText = 'Receipt total: 100 NGN';
  const worker = makeJournalEntryExtractionWorker();

  it.each([pdfText, file])(
    'accepts a valid job with value %j',
    async (value) => {
      await expect(worker({ value, context })).resolves.toBeUndefined();
    }
  );

  it('rejects invalid jobs', async () => {
    await expect(
      worker({
        value: { ...file, size: 0 },
        context,
      })
    ).rejects.toBeInstanceOf(appError.UnprocessableEntity);
  });
});
