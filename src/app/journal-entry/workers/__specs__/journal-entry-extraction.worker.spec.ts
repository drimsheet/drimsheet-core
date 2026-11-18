import appError from '@shared/values/errors/app.error';
import { EFileAttachmentType } from '@shared/values/file-attachments/types/file-attachment.types';

import { IJournalEntryExtractionDto } from '@app/journal-entry/dtos/journal-entry-extraction/journal-entry-extraction.dto';
import makeJournalEntryExtractionWorker from '@app/journal-entry/workers/journal-entry-extraction.worker';

describe('makeJournalEntryExtractionWorker', () => {
  const file = {
    url: 'https://example.com/receipt.png',
    name: 'receipt.png',
    type: EFileAttachmentType.Png,
    size: 1024,
  };
  const pdfText = 'Receipt total: 100 NGN';
  const payload: IJournalEntryExtractionDto = {
    accountId: '123e4567-e89b-12d3-a456-426614174001',
    actorId: '123e4567-e89b-12d3-a456-426614174002',
    accountingEntityId: '123e4567-e89b-12d3-a456-426614174003',
    value: pdfText,
  };
  const worker = makeJournalEntryExtractionWorker();

  it.each([pdfText, file])(
    'accepts a valid job with value %j',
    async (value) => {
      await expect(worker({ ...payload, value })).resolves.toBeUndefined();
    }
  );

  it('rejects invalid jobs', async () => {
    await expect(
      worker({ ...payload, value: { ...file, size: 0 } })
    ).rejects.toBeInstanceOf(appError.UnprocessableEntity);
  });
});
