import { IInitiateJournalEntryExtractionReq } from '@app/journal-entry/dtos/initiate-journal-entry-extraction/initiate-journal-entry-extraction.dto';
import { initiateJournalEntryExtractionReqValidation } from '@app/journal-entry/dtos/initiate-journal-entry-extraction/initiate-journal-entry-extraction.dto.validation';

describe('initiateJournalEntryExtractionReqValidation', () => {
  const request = {
    reference: '123e4567-e89b-12d3-a456-426614174001',
    accountId: '123e4567-e89b-12d3-a456-426614174002',
  } satisfies IInitiateJournalEntryExtractionReq;

  it('accepts a request without a source type', () => {
    expect(initiateJournalEntryExtractionReqValidation.parse(request)).toEqual(
      request
    );
  });

  it('preserves a supported source type', () => {
    const input = {
      ...request,
      sourceType: 'payment',
    } satisfies IInitiateJournalEntryExtractionReq;

    expect(initiateJournalEntryExtractionReqValidation.parse(input)).toEqual(
      input
    );
  });

  it.each([
    ['reference', 'app_error_file_upload_reference_invalid'],
    ['accountId', 'journal_entry_error_journal_line_account_id_invalid'],
  ] as const)('rejects a missing or malformed %s', (field, errorKey) => {
    for (const value of [undefined, 'not-a-uuid']) {
      const parsed = initiateJournalEntryExtractionReqValidation.safeParse({
        ...request,
        [field]: value,
      });

      expect(parsed.error?.issues).toEqual([
        expect.objectContaining({ path: [field], message: errorKey }),
      ]);
    }
  });

  it.each(['unsupported', null])('rejects source type %j', (sourceType) => {
    const parsed = initiateJournalEntryExtractionReqValidation.safeParse({
      ...request,
      sourceType,
    });

    expect(parsed.error?.issues).toEqual([
      expect.objectContaining({
        path: ['sourceType'],
        message: 'journal_entry_error_source_type_invalid',
      }),
    ]);
  });

  it('rejects unexpected request fields', () => {
    const parsed = initiateJournalEntryExtractionReqValidation.safeParse({
      ...request,
      extra: true,
    });

    expect(parsed.error?.issues).toEqual([
      expect.objectContaining({ code: 'unrecognized_keys', keys: ['extra'] }),
    ]);
  });
});
