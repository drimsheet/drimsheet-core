import generateUUID from '@shared/utils/uuid-generator';

import { journalEntryRectificationReqValidation } from '@app/journal-entry/dtos/journal-entry-rectification/journal-entry-rectification.dto.validation';

describe('journalEntryRectificationReqValidation', () => {
  const accountId = generateUUID();
  const lineId = generateUUID();
  const counterparty = { id: generateUUID(), name: 'Vendor' };
  const line = {
    id: lineId,
    accountId,
    counterparty,
    amount: { amount: 100, currencyCode: 'NGN', isMinorUnit: false },
    exchangeRate: null,
    description: 'Description',
    sequenceOrder: 1,
  };
  const base = {
    attachments: [
      {
        url: 'https://files.example.com/receipt.pdf',
        name: 'receipt.pdf',
        type: 'application/pdf',
        size: 1_024,
      },
    ],
    effectiveDate: new Date('2026-09-01T00:00:00.000Z'),
    postedAt: new Date('2026-09-01T00:00:00.000Z'),
    memo: 'Correction',
  };

  it.each([
    {
      ...base,
      sourceType: 'payment',
      sourceLine: line,
      destinationLines: [{ ...line, id: generateUUID(), sequenceOrder: 2 }],
    },
    {
      ...base,
      sourceType: 'receipt',
      sourceLines: [line],
      destinationLine: { ...line, id: generateUUID(), sequenceOrder: 2 },
    },
    {
      ...base,
      sourceType: 'transfer',
      sourceLine: { ...line, counterparty: undefined },
      destinationLine: {
        ...line,
        id: generateUUID(),
        counterparty: undefined,
        sequenceOrder: 2,
      },
      chargeLines: [],
    },
  ])('accepts a complete $sourceType rectification', (payload) => {
    expect(
      journalEntryRectificationReqValidation.safeParse(payload).success
    ).toBe(true);
  });

  it('accepts an empty attachment array as full replacement', () => {
    const result = journalEntryRectificationReqValidation.safeParse({
      ...base,
      sourceType: 'payment',
      attachments: [],
      sourceLine: line,
      destinationLines: [{ ...line, id: generateUUID(), sequenceOrder: 2 }],
    });

    expect(result.success).toBe(true);
  });

  it('rejects system-owned and unknown top-level fields', () => {
    const result = journalEntryRectificationReqValidation.safeParse({
      ...base,
      sourceType: 'payment',
      sourceLine: line,
      destinationLines: [{ ...line, id: generateUUID(), sequenceOrder: 2 }],
      status: 'voided',
    });

    expect(result.success).toBe(false);
  });

  it('rejects malformed line identities and attachments', () => {
    const result = journalEntryRectificationReqValidation.safeParse({
      ...base,
      sourceType: 'payment',
      attachments: [{ ...base.attachments[0], url: 'not-a-url' }],
      sourceLine: { ...line, id: 'not-a-uuid' },
      destinationLines: [],
    });

    expect(result.success).toBe(false);
  });
});
