import {
  IJournalEntriesExtractionInput,
  IJournalEntryExtractionAiResponse,
  IJournalEntryExtractionDto,
} from '@app/journal-entry/dtos/journal-entry-extraction/journal-entry-extraction.dto';
import {
  journalEntriesExtractionInputValidation,
  journalEntryExtractionAiResponseValidation,
  journalEntryExtractionDtoValidation,
} from '@app/journal-entry/dtos/journal-entry-extraction/journal-entry-extraction.dto.validation';

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
      file: { ...payload.file, size: 0 },
    });
    expect(parsed.error?.issues).toEqual([
      expect.objectContaining({
        path: ['file', 'size'],
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

describe('journal entry extraction AI response validation', () => {
  const address = {
    line1: '1 Main Street',
    line2: null,
    city: 'Lagos',
    region: null,
    postalCode: null,
    countryCode: 'NG',
  };
  const payload = {
    ledgerAccounts: [
      {
        value: {
          temporaryId: 'account-1',
          name: 'Bank',
          type: 'asset',
          normalBalance: 'debit',
          subType: 'cash_and_cash_equivalent',
          behavior: 'bank',
        },
        confidence: 0.95,
        evidence: ['Bank statement header'],
      },
    ],
    counterparties: [
      {
        value: {
          temporaryId: 'counterparty-1',
          name: 'Example Ltd',
          type: 'organization',
          roles: ['employer', 'vendor', 'contractor'],
          roleDetails: {
            employer: { displayName: null, address },
            vendor: { address: null },
            contractor: { address },
          },
        },
        confidence: 0.8,
        evidence: [],
      },
    ],
    entries: [
      {
        value: {
          temporaryId: 'entry-1',
          sourceType: 'payment',
          memo: null,
          effectiveDate: '2026-11-17',
          lines: [
            {
              temporaryId: 'line-1',
              accountTemporaryId: 'account-1',
              sequenceOrder: 1,
              amount: { amount: 100, currencyCode: 'USD', isMinorUnit: true },
              exchangeRate: {
                baseCurrencyCode: 'USD',
                targetCurrencyCode: 'NGN',
                rate: 1500,
                type: 'official',
                asOf: new Date('2026-11-17T00:00:00Z'),
                source: 'statement',
              },
              side: 'credit',
              description: null,
              counterpartyTemporaryId: 'counterparty-1',
              functionalAmount: {
                amount: 150000,
                currencyCode: 'NGN',
                isMinorUnit: true,
              },
            },
          ],
        },
        confidence: 1,
        evidence: ['Statement row 1'],
      },
    ],
  } satisfies IJournalEntryExtractionAiResponse;

  const ledgerAccount = payload.ledgerAccounts[0].value;
  const counterparty = payload.counterparties[0].value;
  const entry = payload.entries[0].value;

  it('preserves a complete response including role details and exchange rates', () => {
    const parsed: IJournalEntryExtractionAiResponse =
      journalEntryExtractionAiResponseValidation.parse(payload);
    expect(parsed).toEqual(payload);
  });

  it('accepts empty result collections', () => {
    const empty = { ledgerAccounts: [], counterparties: [], entries: [] };
    expect(journalEntryExtractionAiResponseValidation.parse(empty)).toEqual(
      empty
    );
  });

  it.each(['ledgerAccounts', 'counterparties', 'entries'] as const)(
    'accepts an undetermined %s assessment',
    (field) => {
      const input = {
        ...payload,
        [field]: [{ value: '__undetermined__', confidence: 0, evidence: [] }],
      };
      expect(journalEntryExtractionAiResponseValidation.parse(input)).toEqual(
        input
      );
    }
  );

  it('accepts undetermined fields without requiring resolved domain values', () => {
    const input = {
      ledgerAccounts: [
        {
          ...payload.ledgerAccounts[0],
          value: {
            temporaryId: 'account-1',
            name: '__undetermined__',
            type: '__undetermined__',
            normalBalance: '__undetermined__',
            subType: '__undetermined__',
            behavior: '__undetermined__',
          },
        },
      ],
      counterparties: [
        {
          ...payload.counterparties[0],
          value: {
            temporaryId: 'counterparty-1',
            name: '__undetermined__',
            type: '__undetermined__',
            roles: '__undetermined__',
            roleDetails: {},
          },
        },
      ],
      entries: [
        {
          ...payload.entries[0],
          value: {
            ...entry,
            sourceType: '__undetermined__',
            effectiveDate: '__undetermined__',
            lines: [
              {
                ...entry.lines[0],
                accountTemporaryId: '__undetermined__',
                amount: '__undetermined__',
                exchangeRate: '__undetermined__',
                side: '__undetermined__',
                counterpartyTemporaryId: '__undetermined__',
                functionalAmount: '__undetermined__',
              },
            ],
          },
        },
      ],
    };
    expect(journalEntryExtractionAiResponseValidation.parse(input)).toEqual(
      input
    );
  });

  it.each(['ledgerAccounts', 'counterparties', 'entries'] as const)(
    'rejects missing collections and malformed assessment metadata in %s',
    (field) => {
      expect(
        journalEntryExtractionAiResponseValidation.safeParse({
          ...payload,
          [field]: undefined,
        }).success
      ).toBe(false);

      for (const invalidAssessment of [
        { value: null, confidence: 1, evidence: [] },
        { value: '__undetermined__', evidence: [] },
        { value: '__undetermined__', confidence: 'high', evidence: [] },
        { value: '__undetermined__', confidence: Infinity, evidence: [] },
        { value: '__undetermined__', confidence: 1 },
        { value: '__undetermined__', confidence: 1, evidence: [42] },
        { value: '__undetermined__', confidence: 1, evidence: [], extra: true },
      ]) {
        expect(
          journalEntryExtractionAiResponseValidation.safeParse({
            ...payload,
            [field]: [invalidAssessment],
          }).success
        ).toBe(false);
      }
    }
  );

  it.each(['type', 'normalBalance', 'subType', 'behavior'])(
    'rejects an invalid ledger account %s',
    (field) => {
      const parsed = journalEntryExtractionAiResponseValidation.safeParse({
        ...payload,
        ledgerAccounts: [
          {
            ...payload.ledgerAccounts[0],
            value: { ...ledgerAccount, [field]: 'invalid' },
          },
        ],
      });
      expect(parsed.success).toBe(false);
    }
  );

  it.each([
    { type: 'invalid' },
    { roles: ['invalid'] },
    { roleDetails: { employer: { address } } },
    { roleDetails: { contractor: { address: null } } },
    { roleDetails: { vendor: {} } },
    { roleDetails: { vendor: { address: { ...address, line2: undefined } } } },
    {
      roleDetails: { vendor: { address: { ...address, countryCode: 'NGN' } } },
    },
    { roleDetails: { unknown: {} } },
    { roleDetails: '__undetermined__' },
  ])('rejects malformed counterparties %j', (invalidFields) => {
    expect(
      journalEntryExtractionAiResponseValidation.safeParse({
        ...payload,
        counterparties: [
          {
            ...payload.counterparties[0],
            value: { ...counterparty, ...invalidFields },
          },
        ],
      }).success
    ).toBe(false);
  });

  it.each([
    { sourceType: 'invalid' },
    { effectiveDate: '2026-02-30' },
    { memo: undefined },
    { lines: undefined },
    { temporaryId: 1 },
    { extra: true },
  ])('rejects malformed entries %j', (invalidFields) => {
    expect(
      journalEntryExtractionAiResponseValidation.safeParse({
        ...payload,
        entries: [
          { ...payload.entries[0], value: { ...entry, ...invalidFields } },
        ],
      }).success
    ).toBe(false);
  });

  it.each([
    { accountTemporaryId: null },
    { sequenceOrder: 0 },
    { sequenceOrder: 1.5 },
    { amount: { amount: '100', currencyCode: 'USD', isMinorUnit: true } },
    { functionalAmount: { amount: 100, currencyCode: 'invalid' } },
    { exchangeRate: { rate: -1 } },
    { side: 'invalid' },
    { counterpartyTemporaryId: undefined },
    { description: 1 },
    { extra: true },
  ])('rejects malformed lines %j at their nested path', (invalidFields) => {
    const parsed = journalEntryExtractionAiResponseValidation.safeParse({
      ...payload,
      entries: [
        {
          ...payload.entries[0],
          value: {
            ...entry,
            lines: [{ ...entry.lines[0], ...invalidFields }],
          },
        },
      ],
    });
    expect(parsed.error?.issues[0].path.slice(0, 3)).toEqual([
      'entries',
      0,
      'value',
    ]);
  });

  it('accepts null exchange rates and counterparty references', () => {
    const input = {
      ...payload,
      entries: [
        {
          ...payload.entries[0],
          value: {
            ...entry,
            lines: [
              {
                ...entry.lines[0],
                exchangeRate: null,
                counterpartyTemporaryId: null,
              },
            ],
          },
        },
      ],
    };
    expect(journalEntryExtractionAiResponseValidation.parse(input)).toEqual(
      input
    );
  });

  it('rejects unexpected response fields', () => {
    expect(
      journalEntryExtractionAiResponseValidation.safeParse({
        ...payload,
        extra: true,
      }).success
    ).toBe(false);
  });
});
