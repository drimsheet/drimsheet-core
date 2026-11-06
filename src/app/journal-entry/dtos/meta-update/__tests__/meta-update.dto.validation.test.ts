import { journalEntryMetaUpdateReqValidation } from '@app/journal-entry/dtos/meta-update/meta-update.dto.validation';

const id = '123e4567-e89b-42d3-a456-426614174000';

describe('journalEntryMetaUpdateReqValidation', () => {
  it.each([
    {},
    { header: {} },
    { header: { memo: 'Memo' } },
    { header: { memo: null } },
    { lines: [] },
    { lines: [{ id }] },
    { lines: [{ id, description: 'Description' }] },
    { lines: [{ id, description: null }] },
  ])('accepts partial metadata %j', (payload) => {
    expect(journalEntryMetaUpdateReqValidation.safeParse(payload).success).toBe(
      true
    );
  });

  it.each([
    null,
    { header: null },
    { header: { memo: 10 } },
    { lines: null },
    { lines: [{}] },
    { lines: [{ id: 'invalid' }] },
    { lines: [{ id, description: 10 }] },
    { header: { amount: 10 } },
    { lines: [{ id, amount: 10 }] },
    { postedAt: null },
  ])('rejects malformed and non-metadata fields %j', (payload) => {
    expect(journalEntryMetaUpdateReqValidation.safeParse(payload).success).toBe(
      false
    );
  });
});
