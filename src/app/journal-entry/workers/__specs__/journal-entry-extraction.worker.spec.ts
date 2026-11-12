import { EFileAttachmentType } from '@shared/values/file-attachments/types/file-attachment.types';

import { IJournalEntryExtractionDto } from '@app/journal-entry/dtos/journal-entry-extraction/journal-entry-extraction.dto';
import makeJournalEntryExtractionWorker from '@app/journal-entry/workers/journal-entry-extraction.worker';

describe('makeJournalEntryExtractionWorker', () => {
  const payload: IJournalEntryExtractionDto = {
    accountId: '123e4567-e89b-12d3-a456-426614174001',
    actorId: '123e4567-e89b-12d3-a456-426614174002',
    accountingEntityId: '123e4567-e89b-12d3-a456-426614174003',
    file: {
      url: 'https://example.com/receipt.pdf',
      name: 'receipt.pdf',
      type: EFileAttachmentType.Pdf,
      size: 1024,
    },
  };

  it('passes the extraction job to the use case', async () => {
    const usecase = jest.fn().mockResolvedValue(undefined);
    const worker = makeJournalEntryExtractionWorker({ usecase });

    await worker(payload);

    expect(usecase).toHaveBeenCalledTimes(1);
    expect(usecase).toHaveBeenCalledWith(payload);
  });

  it('propagates extraction failures for queue retry handling', async () => {
    const extractionError = new Error('extraction failed');
    const usecase = jest.fn().mockRejectedValue(extractionError);
    const worker = makeJournalEntryExtractionWorker({ usecase });

    await expect(worker(payload)).rejects.toBe(extractionError);
  });
});
