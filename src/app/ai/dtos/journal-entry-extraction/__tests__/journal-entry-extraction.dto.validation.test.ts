import generateUUID from '@shared/utils/uuid-generator';

import { IJournalEntryExtractionDto } from '@app/ai/dtos/journal-entry-extraction/journal-entry-extraction.dto';
import { journalEntryExtractionDtoValidation } from '@app/ai/dtos/journal-entry-extraction/journal-entry-extraction.dto.validation';

describe('journal entry extraction DTO validation', () => {
  const file = {
    url: 'https://example.com/receipt.png',
    name: 'receipt.png',
    type: 'png',
    size: 1024,
  };
  const payload: IJournalEntryExtractionDto = {
    file,
    accountingEntityId: generateUUID(),
    correlationId: generateUUID(),
    delegatingActorId: generateUUID(),
  };

  it('preserves the original attachment and run identifiers', () => {
    expect(journalEntryExtractionDtoValidation.parse(payload)).toEqual(payload);
  });

  it.each(['accountingEntityId', 'correlationId', 'delegatingActorId'])(
    'requires a valid UUID for %s',
    (field) => {
      const parsed = journalEntryExtractionDtoValidation.safeParse({
        ...payload,
        [field]: 'invalid',
      });
      expect(parsed.error?.issues).toEqual([
        expect.objectContaining({ path: [field] }),
      ]);
    }
  );

  it.each([undefined, 'Receipt text', { ...file, size: 0 }])(
    'rejects missing or invalid attachments %j',
    (invalidFile) => {
      expect(
        journalEntryExtractionDtoValidation.safeParse({
          ...payload,
          file: invalidFile,
        }).success
      ).toBe(false);
    }
  );

  it('rejects additional run metadata', () => {
    expect(
      journalEntryExtractionDtoValidation.safeParse({
        ...payload,
        initiatedOn: '2026-11-20T10:00:00.000Z',
      }).success
    ).toBe(false);
  });
});
