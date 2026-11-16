import { IJournalEntryExtractionDto } from '@app/journal-entry/dtos/journal-entry-extraction/journal-entry-extraction.dto';
import { journalEntryExtractionDtoValidation } from '@app/journal-entry/dtos/journal-entry-extraction/journal-entry-extraction.dto.validation';

describe('journal entry extraction DTO validation', () => {
  const payload: IJournalEntryExtractionDto = {
    accountId: '123e4567-e89b-12d3-a456-426614174001',
    actorId: '123e4567-e89b-12d3-a456-426614174002',
    accountingEntityId: '123e4567-e89b-12d3-a456-426614174003',
    file: {
      url: 'https://example.com/receipt.pdf',
      name: 'receipt.pdf',
      type: 'pdf',
      size: 1024,
    },
  };

  it('preserves a complete payload with an optional source type', () => {
    const parsed: IJournalEntryExtractionDto =
      journalEntryExtractionDtoValidation.parse(payload);
    expect(parsed).toEqual(payload);
    expect(
      journalEntryExtractionDtoValidation.parse({
        ...payload,
        sourceType: 'payment',
      })
    ).toEqual({ ...payload, sourceType: 'payment' });
  });

  it.each([
    'pdf',
    'excel',
    'jpg',
    'png',
    'csv',
    'application/pdf',
    'image/jpeg',
  ])('accepts supported attachment type %s without changing it', (type) => {
    const input = { ...payload, file: { ...payload.file, type } };
    expect(journalEntryExtractionDtoValidation.parse(input)).toEqual(input);
  });

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

  it.each([
    {
      field: 'url',
      value: 'invalid',
      message: 'file_attachment_error_url_invalid',
    },
    {
      field: 'url',
      value: 'ftp://example.com/receipt.pdf',
      message: 'file_attachment_error_url_invalid',
    },
    {
      field: 'name',
      value: ' ',
      message: 'file_attachment_error_name_invalid',
    },
    {
      field: 'type',
      value: 'invalid',
      message: 'file_attachment_error_type_invalid',
    },
    { field: 'type', value: '', message: 'file_attachment_error_type_invalid' },
    { field: 'size', value: 0, message: 'file_attachment_error_size_invalid' },
    { field: 'size', value: -1, message: 'file_attachment_error_size_invalid' },
    {
      field: 'size',
      value: Infinity,
      message: 'file_attachment_error_size_invalid',
    },
  ])(
    'reports invalid file $field at its nested path',
    ({ field, value, message }) => {
      const parsed = journalEntryExtractionDtoValidation.safeParse({
        ...payload,
        file: { ...payload.file, [field]: value },
      });
      expect(parsed.error?.issues).toEqual([
        expect.objectContaining({ path: ['file', field], message }),
      ]);
    }
  );

  it.each([undefined, null, {}])(
    'rejects an incomplete attachment %j',
    (file) => {
      expect(
        journalEntryExtractionDtoValidation.safeParse({
          ...payload,
          file,
        }).success
      ).toBe(false);
    }
  );

  it('rejects unexpected payload fields', () => {
    expect(
      journalEntryExtractionDtoValidation.safeParse({
        ...payload,
        extra: true,
      }).success
    ).toBe(false);
  });
});
