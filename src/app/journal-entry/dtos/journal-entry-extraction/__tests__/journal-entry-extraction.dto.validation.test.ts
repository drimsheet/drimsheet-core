import {
  IJournalEntryExtractionAiResponse,
  IJournalEntryExtractionDto,
} from '@app/journal-entry/dtos/journal-entry-extraction/journal-entry-extraction.dto';
import {
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

describe('journal entry extraction AI response validation', () => {
  const address = {
    line1: '1 Main Street',
    line2: null,
    city: 'Lagos',
    region: null,
    postalCode: null,
    countryCode: 'NG',
  };
  const money = { amount: 25000, currencyCode: 'NGN', isMinorUnit: true };
  const account = {
    temporaryId: 'account_1',
    name: 'Office supplies',
    type: 'expense',
    normalBalance: 'debit',
    subType: 'direct_costs',
    behavior: 'default_direct_cost',
  };
  const counterparty = {
    temporaryId: 'counterparty_1',
    name: 'Acme',
    type: 'organization',
    roles: ['vendor'],
    roleDetails: { vendor: { address: null } },
  };
  const line = {
    temporaryId: 'line_1',
    accountTemporaryId: 'account_1',
    sequenceOrder: 1,
    amount: money,
    exchangeRate: null,
    side: 'debit',
    description: null,
    counterpartyTemporaryId: 'counterparty_1',
    functionalAmount: money,
  };
  const entry = {
    temporaryId: 'entry_1',
    sourceType: 'payment',
    memo: null,
    effectiveDate: '2026-11-16',
    lines: [line],
  };
  const response = {
    ledgerAccounts: [
      { value: account, confidence: 0.9, evidence: ['Supplies'] },
    ],
    counterparties: [
      { value: counterparty, confidence: 1, evidence: ['ACME'] },
    ],
    entries: [{ value: entry, confidence: 0.8, evidence: ['Paid NGN 250.00'] }],
  };

  it('parses a response into the declared DTO without UUID requirements', () => {
    const parsed: IJournalEntryExtractionAiResponse =
      journalEntryExtractionAiResponseValidation.parse(response);
    expect(parsed).toEqual(response);
  });

  it('accepts empty collections and entirely undetermined records', () => {
    expect(
      journalEntryExtractionAiResponseValidation.parse({
        ledgerAccounts: [],
        counterparties: [],
        entries: [],
      })
    ).toEqual({ ledgerAccounts: [], counterparties: [], entries: [] });

    const assessment = {
      value: '__undetermined__',
      confidence: 0,
      evidence: [],
    };
    const unresolved = {
      ledgerAccounts: [assessment],
      counterparties: [assessment],
      entries: [assessment],
    };
    expect(
      journalEntryExtractionAiResponseValidation.parse(unresolved)
    ).toEqual(unresolved);
  });

  it('preserves partially determined records and their temporary IDs', () => {
    const unknownAccount = {
      temporaryId: 'account_1',
      name: '__undetermined__',
      type: '__undetermined__',
      normalBalance: '__undetermined__',
      subType: '__undetermined__',
      behavior: '__undetermined__',
    };
    const unknownCounterparty = {
      temporaryId: 'counterparty_1',
      name: '__undetermined__',
      type: '__undetermined__',
      roles: '__undetermined__',
      roleDetails: {},
    };
    const unknownEntry = {
      ...entry,
      sourceType: '__undetermined__',
      effectiveDate: '__undetermined__',
      lines: [
        {
          ...line,
          accountTemporaryId: '__undetermined__',
          amount: '__undetermined__',
          exchangeRate: '__undetermined__',
          side: '__undetermined__',
          counterpartyTemporaryId: '__undetermined__',
          functionalAmount: '__undetermined__',
        },
      ],
    };
    const unresolved = {
      ledgerAccounts: [{ value: unknownAccount, confidence: 0, evidence: [] }],
      counterparties: [
        { value: unknownCounterparty, confidence: 0, evidence: [] },
      ],
      entries: [{ value: unknownEntry, confidence: 0, evidence: [] }],
    };
    expect(
      journalEntryExtractionAiResponseValidation.parse(unresolved)
    ).toEqual(unresolved);
  });

  it('preserves all role details and nullable address fields', () => {
    const roleDetails = {
      employer: { displayName: null, address },
      vendor: { address },
      contractor: { address },
    };
    const payload = {
      ...response,
      counterparties: [
        {
          ...response.counterparties[0],
          value: { ...counterparty, roleDetails },
        },
      ],
    };
    expect(journalEntryExtractionAiResponseValidation.parse(payload)).toEqual(
      payload
    );
  });

  it('uses the existing exchange rate parser and preserves effective-date strings', () => {
    const rate = {
      baseCurrencyCode: 'USD',
      targetCurrencyCode: 'NGN',
      rate: 1600,
      type: 'market',
      asOf: '2026-11-16T09:00:00Z',
      source: 'Receipt',
    };
    const payload = {
      ...response,
      entries: [
        {
          ...response.entries[0],
          value: {
            ...entry,
            effectiveDate: '2026-11-16T10:00:00+01:00',
            lines: [
              { ...line, counterpartyTemporaryId: null, exchangeRate: rate },
            ],
          },
        },
      ],
    };
    expect(
      journalEntryExtractionAiResponseValidation.parse(payload).entries
    ).toEqual([
      {
        ...payload.entries[0],
        value: {
          ...payload.entries[0].value,
          lines: [
            {
              ...payload.entries[0].value.lines[0],
              exchangeRate: { ...rate, asOf: new Date(rate.asOf) },
            },
          ],
        },
      },
    ]);
  });

  it.each([
    { temporaryId: '' },
    { type: 'invalid' },
    { normalBalance: 'invalid' },
    { subType: 'invalid' },
    { behavior: 'invalid' },
  ])('rejects malformed account fields %j', (fields) => {
    expect(
      journalEntryExtractionAiResponseValidation.safeParse({
        ...response,
        ledgerAccounts: [
          { ...response.ledgerAccounts[0], value: { ...account, ...fields } },
        ],
      }).success
    ).toBe(false);
  });

  it.each([
    { name: '' },
    { type: 'invalid' },
    { roles: ['invalid'] },
    { roleDetails: null },
    { roleDetails: { employer: {} } },
    { roleDetails: { contractor: { address: { city: 'Lagos' } } } },
  ])('rejects malformed counterparty fields %j', (fields) => {
    expect(
      journalEntryExtractionAiResponseValidation.safeParse({
        ...response,
        counterparties: [
          {
            ...response.counterparties[0],
            value: { ...counterparty, ...fields },
          },
        ],
      }).success
    ).toBe(false);
  });

  it.each([
    { effectiveDate: 'invalid' },
    { effectiveDate: '2026-02-30' },
    { sourceType: 'invalid' },
    { lines: [{ ...line, side: 'invalid' }] },
    { lines: [{ ...line, sequenceOrder: 0 }] },
    { lines: [{ ...line, sequenceOrder: 1.5 }] },
    { lines: [{ ...line, accountTemporaryId: ' ' }] },
    { lines: [{ ...line, amount: { ...money, currencyCode: 'N' } }] },
    { lines: [{ ...line, amount: { amount: 10 } }] },
    { lines: [{ ...line, functionalAmount: null }] },
  ])('rejects malformed entry fields %j', (fields) => {
    expect(
      journalEntryExtractionAiResponseValidation.safeParse({
        ...response,
        entries: [{ ...response.entries[0], value: { ...entry, ...fields } }],
      }).success
    ).toBe(false);
  });
});
