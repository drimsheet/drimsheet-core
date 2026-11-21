import { IInitiateJournalEntryExtractionReq } from '@app/journal-entry/dtos/initiate-journal-entry-extraction/initiate-journal-entry-extraction.dto';
import { initiateJournalEntryExtractionReqValidation } from '@app/journal-entry/dtos/initiate-journal-entry-extraction/initiate-journal-entry-extraction.dto.validation';

describe('initiateJournalEntryExtractionReqValidation', () => {
  const request = {
    reference: '123e4567-e89b-12d3-a456-426614174001',
  } satisfies IInitiateJournalEntryExtractionReq;

  it('accepts a request with only an upload reference', () => {
    expect(initiateJournalEntryExtractionReqValidation.parse(request)).toEqual(
      request
    );
  });

  it.each([undefined, 'not-a-uuid'])(
    'rejects upload reference %j',
    (reference) => {
      const parsed = initiateJournalEntryExtractionReqValidation.safeParse({
        reference,
      });

      expect(parsed.error?.issues).toEqual([
        expect.objectContaining({
          path: ['reference'],
          message: 'app_error_file_upload_reference_invalid',
        }),
      ]);
    }
  );

  it.each([
    ['accountId', '123e4567-e89b-12d3-a456-426614174002'],
    ['sourceType', 'payment'],
  ])('rejects the unexpected field %s', (field, value) => {
    const parsed = initiateJournalEntryExtractionReqValidation.safeParse({
      ...request,
      [field]: value,
    });

    expect(parsed.error?.issues).toEqual([
      expect.objectContaining({ code: 'unrecognized_keys', keys: [field] }),
    ]);
  });
});
