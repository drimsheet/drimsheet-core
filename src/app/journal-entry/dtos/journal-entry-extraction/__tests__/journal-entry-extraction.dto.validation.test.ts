import {
  IJournalEntriesExtractionInput,
  IJournalEntryExtractionDto,
} from '@app/journal-entry/dtos/journal-entry-extraction/journal-entry-extraction.dto';
import {
  journalEntriesExtractionInputValidation,
  journalEntryExtractionDtoValidation,
} from '@app/journal-entry/dtos/journal-entry-extraction/journal-entry-extraction.dto.validation';

describe('journal entry extraction DTO validation', () => {
  const attachment = {
    url: 'https://example.com/receipt.png',
    name: 'receipt.png',
    type: 'png',
    size: 1024,
  };
  const payload: IJournalEntryExtractionDto = {
    accountId: '123e4567-e89b-12d3-a456-426614174001',
    actorId: '123e4567-e89b-12d3-a456-426614174002',
    accountingEntityId: '123e4567-e89b-12d3-a456-426614174003',
    value: attachment,
  };

  it.each([attachment, 'Receipt total: 100 NGN'])(
    'preserves extraction input %j with an optional source type',
    (value) => {
      const job = { ...payload, value };
      expect(journalEntryExtractionDtoValidation.parse(job)).toEqual(job);
      expect(
        journalEntryExtractionDtoValidation.parse({
          ...job,
          sourceType: 'payment',
        })
      ).toEqual({ ...job, sourceType: 'payment' });
    }
  );

  it.each(['accountId', 'actorId', 'accountingEntityId'] as const)(
    'rejects a missing, malformed, or undetermined %s',
    (field) => {
      for (const value of [undefined, 'invalid', '__undetermined__']) {
        const parsed = journalEntryExtractionDtoValidation.safeParse({
          ...payload,
          [field]: value,
        });
        expect(parsed.error?.issues).toEqual([
          expect.objectContaining({ path: [field] }),
        ]);
      }
    }
  );

  it.each(['invalid', '__undetermined__', null])(
    'rejects unsupported source type %j',
    (sourceType) => {
      expect(
        journalEntryExtractionDtoValidation.safeParse({
          ...payload,
          sourceType,
        }).success
      ).toBe(false);
    }
  );

  it('reports invalid attachments at their nested path', () => {
    const parsed = journalEntryExtractionDtoValidation.safeParse({
      ...payload,
      value: { ...attachment, size: 0 },
    });
    expect(parsed.error?.issues).toEqual([
      expect.objectContaining({
        path: ['value', 'size'],
        message: 'file_attachment_error_size_invalid',
      }),
    ]);
  });

  it('rejects unexpected payload fields', () => {
    expect(
      journalEntryExtractionDtoValidation.safeParse({
        ...payload,
        extra: true,
      }).success
    ).toBe(false);
  });
});

describe('journal entries extraction input validation', () => {
  const attachment = {
    url: 'https://example.com/receipt.pdf',
    name: 'receipt.pdf',
    type: 'pdf',
    size: 1024,
  };

  it.each(['Receipt text\nTotal: 100 NGN', '', 'string', attachment])(
    'preserves input %j',
    (value) => {
      const input: IJournalEntriesExtractionInput = { value };
      const parsed: IJournalEntriesExtractionInput =
        journalEntriesExtractionInputValidation.parse(input);
      expect(parsed).toEqual(input);
    }
  );

  it.each([
    undefined,
    null,
    42,
    true,
    [],
    {},
    { ...attachment, size: 0 },
    { ...attachment, type: 'unsupported' },
    { ...attachment, url: 'invalid' },
  ])('rejects missing or invalid input %j', (value) => {
    expect(
      journalEntriesExtractionInputValidation.safeParse({ value }).success
    ).toBe(false);
  });

  it('rejects unexpected input fields', () => {
    expect(
      journalEntriesExtractionInputValidation.safeParse({
        value: 'Receipt text',
        extra: true,
      }).success
    ).toBe(false);
  });
});
