import fileAppError from '@app/file/errors/file.error';
import { ITransferEntryReq } from '@app/journal-entry/dtos/transfer-entry/transfer-entry.dto';
import { transferEntryReqValidation } from '@app/journal-entry/dtos/transfer-entry/transfer-entry.dto.validation';

const sourceLine = {
  accountId: '1b4c1064-a09e-4e4f-b6a3-23945cc87f75',
  amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
  exchangeRate: null,
  description: 'Transfer from bank',
  sequenceOrder: 1,
};

const destinationLine = {
  accountId: '2b4c1064-a09e-4e4f-b6a3-23945cc87f74',
  amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
  exchangeRate: null,
  description: 'Transfer to petty cash',
  sequenceOrder: 2,
};

const chargeLine = {
  accountId: '3b4c1064-a09e-4e4f-b6a3-23945cc87f76',
  counterparty: { name: 'Transfer provider' },
  amount: { amount: 50, currencyCode: 'NGN', isMinorUnit: true },
  exchangeRate: null,
  description: 'Transfer fee',
  sequenceOrder: 3,
};

function makePayload(): ITransferEntryReq {
  return {
    attachmentReferences: ['4b4c1064-a09e-4e4f-b6a3-23945cc87f77'],
    sourceLine,
    destinationLine,
    chargeLines: [],
    effectiveDate: new Date('2026-08-30T00:00:00.000Z'),
    postedAt: null,
    memo: 'Cash transfer',
  };
}

describe('Transfer Entry DTO Validation', () => {
  it('validates a transfer request', () => {
    expect(transferEntryReqValidation.safeParse(makePayload()).success).toBe(
      true
    );
  });

  it('accepts omitted and empty attachment references', () => {
    const payload = makePayload();
    const { attachmentReferences: _references, ...withoutReferences } = payload;

    expect(
      transferEntryReqValidation.safeParse(withoutReferences).success
    ).toBe(true);
    expect(
      transferEntryReqValidation.shape.attachmentReferences.safeParse([])
        .success
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
      const result = transferEntryReqValidation.safeParse({
        ...makePayload(),
        attachmentReferences,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(new ErrorClass().errorKey);
      }
    }
  );

  it('counts duplicate attachment references toward the upload limit', () => {
    const reference = '4b4c1064-a09e-4e4f-b6a3-23945cc87f77';
    const result = transferEntryReqValidation.safeParse({
      ...makePayload(),
      attachmentReferences: [reference, reference],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain(
        new fileAppError.InvalidUploadCount().errorKey
      );
    }
  });

  it('accepts multiple charge lines with nullable counterparties', () => {
    const payload = makePayload();

    payload.chargeLines = [
      chargeLine,
      {
        ...chargeLine,
        accountId: '4b4c1064-a09e-4e4f-b6a3-23945cc87f79',
        counterparty: null,
        sequenceOrder: 4,
      },
    ];

    expect(transferEntryReqValidation.safeParse(payload).success).toBe(true);
  });

  it('rejects a missing destination line', () => {
    const { destinationLine: _destinationLine, ...payload } = makePayload();

    expect(transferEntryReqValidation.safeParse(payload).success).toBe(false);
  });

  it('rejects missing charge lines', () => {
    const { chargeLines: _chargeLines, ...payload } = makePayload();

    expect(transferEntryReqValidation.safeParse(payload).success).toBe(false);
  });

  it('rejects the obsolete plural destination shape', () => {
    const { destinationLine: _destinationLine, ...payload } = makePayload();

    expect(
      transferEntryReqValidation.safeParse({
        ...payload,
        destinationLines: [destinationLine],
      }).success
    ).toBe(false);
  });
});
