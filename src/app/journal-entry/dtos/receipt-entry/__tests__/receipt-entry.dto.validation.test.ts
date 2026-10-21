import fileAppError from '@app/file/errors/file.error';
import { receiptEntryReqValidation } from '@app/journal-entry/dtos/receipt-entry/receipt-entry.dto.validation';

describe('Receipt Entry DTO Validation', () => {
  it('should validate a correct receipt entry request payload', () => {
    const payload = {
      attachmentReferences: ['4b4c1064-a09e-4e4f-b6a3-23945cc87f77'],
      sourceLines: [
        {
          accountId: '2b4c1064-a09e-4e4f-b6a3-23945cc87f74',
          counterparty: {
            id: '3b4c1064-a09e-4e4f-b6a3-23945cc87f76',
            name: 'Customer',
          },
          amount: {
            amount: 900,
            currencyCode: 'USD',
            isMinorUnit: true,
          },
          exchangeRate: null,
          description: 'Sales revenue',
          sequenceOrder: 1,
        },
        {
          accountId: '4b4c1064-a09e-4e4f-b6a3-23945cc87f74',
          counterparty: { name: 'Tax authority' },
          amount: {
            amount: 100,
            currencyCode: 'USD',
            isMinorUnit: true,
          },
          exchangeRate: null,
          description: 'VAT payable',
          sequenceOrder: 2,
        },
      ],
      destinationLine: {
        accountId: '1b4c1064-a09e-4e4f-b6a3-23945cc87f75',
        counterparty: {
          name: 'Customer',
        },
        amount: {
          amount: 1000,
          currencyCode: 'USD',
          isMinorUnit: true,
        },
        exchangeRate: null,
        description: 'Cash received',
        sequenceOrder: 3,
      },
      effectiveDate: new Date('2026-07-13T18:00:00Z'),
      postedAt: null,
      memo: 'Valid memo',
    };

    const result = receiptEntryReqValidation.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('accepts an omitted attachment reference collection', () => {
    const payload = {
      sourceLines: [
        {
          accountId: '2b4c1064-a09e-4e4f-b6a3-23945cc87f74',
          counterparty: { name: 'Customer' },
          amount: { amount: 1000, currencyCode: 'USD', isMinorUnit: true },
          exchangeRate: null,
          description: 'Source Line',
          sequenceOrder: 1,
        },
      ],
      destinationLine: {
        accountId: '1b4c1064-a09e-4e4f-b6a3-23945cc87f75',
        counterparty: { name: 'Customer' },
        amount: { amount: 1000, currencyCode: 'USD', isMinorUnit: true },
        exchangeRate: null,
        description: 'Destination Line',
        sequenceOrder: 2,
      },
      effectiveDate: new Date('2026-07-13T18:00:00Z'),
      postedAt: null,
      memo: null,
    };

    expect(receiptEntryReqValidation.safeParse(payload).success).toBe(true);
  });

  it('accepts an empty attachment reference collection', () => {
    expect(
      receiptEntryReqValidation.shape.attachmentReferences.safeParse([]).success
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
      const result = receiptEntryReqValidation.safeParse({
        attachmentReferences,
        sourceLines: [
          {
            accountId: '2b4c1064-a09e-4e4f-b6a3-23945cc87f74',
            counterparty: { name: 'Customer' },
            amount: { amount: 1000, currencyCode: 'USD', isMinorUnit: true },
            exchangeRate: null,
            description: 'Source Line',
            sequenceOrder: 1,
          },
        ],
        destinationLine: {
          accountId: '1b4c1064-a09e-4e4f-b6a3-23945cc87f75',
          counterparty: { name: 'Customer' },
          amount: { amount: 1000, currencyCode: 'USD', isMinorUnit: true },
          exchangeRate: null,
          description: 'Destination Line',
          sequenceOrder: 2,
        },
        effectiveDate: new Date('2026-07-13T18:00:00Z'),
        postedAt: null,
        memo: null,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(new ErrorClass().errorKey);
      }
    }
  );

  it('counts duplicate attachment references toward the upload limit', () => {
    const reference = '4b4c1064-a09e-4e4f-b6a3-23945cc87f77';
    const result =
      receiptEntryReqValidation.shape.attachmentReferences.safeParse([
        reference,
        reference,
      ]);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain(
        new fileAppError.InvalidUploadCount().errorKey
      );
    }
  });

  it('should fail validation if counterparty is null in sourceLines', () => {
    const payload = {
      sourceLines: [
        {
          accountId: '2b4c1064-a09e-4e4f-b6a3-23945cc87f74',
          counterparty: null,
          amount: {
            amount: 1000,
            currencyCode: 'USD',
            isMinorUnit: true,
          },
          exchangeRate: null,
          description: 'Source Line',
          sequenceOrder: 1,
        },
      ],
      destinationLine: {
        accountId: '1b4c1064-a09e-4e4f-b6a3-23945cc87f75',
        counterparty: {
          name: 'Customer',
        },
        amount: {
          amount: 1000,
          currencyCode: 'USD',
          isMinorUnit: true,
        },
        exchangeRate: null,
        description: 'Destination Line',
        sequenceOrder: 2,
      },
      effectiveDate: new Date('2026-07-13T18:00:00Z'),
      postedAt: null,
      memo: 'Valid memo',
    };

    const result = receiptEntryReqValidation.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('should fail validation if sourceLines is empty', () => {
    const payload = {
      sourceLines: [],
      destinationLine: {
        accountId: '1b4c1064-a09e-4e4f-b6a3-23945cc87f75',
        counterparty: { name: 'Customer' },
        amount: {
          amount: 1000,
          currencyCode: 'USD',
          isMinorUnit: true,
        },
        exchangeRate: null,
        description: 'Destination Line',
        sequenceOrder: 1,
      },
      effectiveDate: new Date('2026-07-13T18:00:00Z'),
      postedAt: null,
      memo: null,
    };

    const result = receiptEntryReqValidation.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('should fail validation for the legacy receipt line shape', () => {
    const result = receiptEntryReqValidation.safeParse({
      sourceLine: {},
      destinationLines: [],
      effectiveDate: new Date('2026-07-13T18:00:00Z'),
      postedAt: null,
      memo: null,
    });

    expect(result.success).toBe(false);
  });
});
