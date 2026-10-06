import counterpartyError from '@domain/counterparty/errors/counterparty.error';

import fileAppError from '@app/file/errors/file.error';
import { journalEntryRectificationReqValidation } from '@app/journal-entry/dtos/journal-entry-rectification/journal-entry-rectification.dto.validation';
import { journalLineReqValidation } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto.validation';
import { paymentEntryReqValidation } from '@app/journal-entry/dtos/payment-entry/payment-entry.dto.validation';
import { receiptEntryReqValidation } from '@app/journal-entry/dtos/receipt-entry/receipt-entry.dto.validation';

const sourceLine = {
  accountId: '1b4c1064-a09e-4e4f-b6a3-23945cc87f75',
  counterparty: { name: 'Vendor' },
  amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
  exchangeRate: null,
  description: 'Bank payment',
  sequenceOrder: 1,
};

const destinationLine = {
  accountId: '2b4c1064-a09e-4e4f-b6a3-23945cc87f74',
  counterparty: {
    id: '3b4c1064-a09e-4e4f-b6a3-23945cc87f76',
    name: 'Vendor',
  },
  amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
  exchangeRate: null,
  description: 'Rent expense',
  sequenceOrder: 2,
};

function makePayload() {
  return {
    attachmentReferences: ['4b4c1064-a09e-4e4f-b6a3-23945cc87f77'],
    sourceLine,
    destinationLines: [destinationLine],
    effectiveDate: new Date('2026-08-30T00:00:00.000Z'),
    postedAt: null,
    memo: 'Office rent payment',
  };
}

describe('Payment Entry DTO Validation', () => {
  it.each(['individual', 'organization', 'invalid'])(
    'validates inline counterparty type %s across journal request schemas',
    (type) => {
      const line = { ...sourceLine, counterparty: { name: 'Supplier', type } };
      const base = {
        effectiveDate: new Date('2026-08-30'),
        postedAt: null,
        memo: null,
      };
      const results = [
        journalLineReqValidation.safeParse(line),
        paymentEntryReqValidation.safeParse({
          ...base,
          sourceLine: line,
          destinationLines: [line],
        }),
        receiptEntryReqValidation.safeParse({
          ...base,
          sourceLines: [line],
          destinationLine: line,
        }),
        journalEntryRectificationReqValidation.safeParse({
          ...base,
          sourceType: 'payment',
          attachments: [],
          sourceLine: line,
          destinationLines: [line],
        }),
        journalEntryRectificationReqValidation.safeParse({
          ...base,
          sourceType: 'receipt',
          attachments: [],
          sourceLines: [line],
          destinationLine: line,
        }),
      ];
      for (const result of results) {
        expect(result.success).toBe(type !== 'invalid');
        if (!result.success)
          expect(result.error.issues[0].message).toBe(
            new counterpartyError.InvalidType().errorKey
          );
      }
    }
  );

  it('validates a payment request', () => {
    expect(paymentEntryReqValidation.safeParse(makePayload()).success).toBe(
      true
    );
  });

  it('accepts omitted and empty attachment references', () => {
    const payload = makePayload();
    const { attachmentReferences: _references, ...withoutReferences } = payload;

    expect(paymentEntryReqValidation.safeParse(withoutReferences).success).toBe(
      true
    );
    expect(
      paymentEntryReqValidation.shape.attachmentReferences.safeParse([]).success
    ).toBe(true);
  });

  it.each([
    ['malformed', ['not-a-uuid'], fileAppError.InvalidUploadReference],
    [
      'excessive',
      [
        '4b4c1064-a09e-4e4f-b6a3-23945cc87f77',
        '5b4c1064-a09e-4e4f-b6a3-23945cc87f78',
      ],
      fileAppError.InvalidUploadCount,
    ],
  ])(
    'rejects %s attachment references',
    (_case, attachmentReferences, ErrorClass) => {
      const result = paymentEntryReqValidation.safeParse({
        ...makePayload(),
        attachmentReferences,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(new ErrorClass().errorKey);
      }
    }
  );

  it('rejects duplicate attachment references', () => {
    const reference = '4b4c1064-a09e-4e4f-b6a3-23945cc87f77';
    const result = paymentEntryReqValidation.safeParse({
      ...makePayload(),
      attachmentReferences: [reference, reference],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain(
        new fileAppError.InvalidUploadReference().errorKey
      );
    }
  });

  it.each([
    ['source', { sourceLine: { ...sourceLine, counterparty: null } }],
    [
      'destination',
      {
        destinationLines: [{ ...destinationLine, counterparty: null }],
      },
    ],
  ])('rejects a null %s counterparty', (_case, override) => {
    expect(
      paymentEntryReqValidation.safeParse({ ...makePayload(), ...override })
        .success
    ).toBe(false);
  });

  it('rejects an empty destination collection', () => {
    expect(
      paymentEntryReqValidation.safeParse({
        ...makePayload(),
        destinationLines: [],
      }).success
    ).toBe(false);
  });

  it('rejects the receipt line cardinality', () => {
    const payload = makePayload();

    expect(
      paymentEntryReqValidation.safeParse({
        sourceLines: [payload.sourceLine],
        destinationLine: payload.destinationLines[0],
        effectiveDate: payload.effectiveDate,
        postedAt: payload.postedAt,
        memo: payload.memo,
      }).success
    ).toBe(false);
  });
});
