import { Response } from 'openai/resources/responses/responses';

import mockFileStorageClient from '@app/file/contracts/clients/__mocks__/file-storage-client.mock';
import journalEntryAppError from '@app/journal-entry/errors/journal-entry.error';

import makeJournalEntryLlmProposer from '@infra/ai/structured-calls/journal-entry-proposer/journal-entry-proposer';
import openAiClient from '@infra/config/openai.config';

jest.mock('@infra/config/openai.config', () => ({
  __esModule: true,
  default: { responses: { create: jest.fn() } },
}));

const emptyProposals = {
  ledgerAccounts: [],
  counterparties: [],
  entries: [],
};

const providerResponse: Response = {
  id: 'response-1',
  access_programs: null,
  created_at: 1,
  error: null,
  incomplete_details: null,
  instructions: null,
  metadata: null,
  model: 'gpt-5.5',
  object: 'response',
  output: [],
  output_text: JSON.stringify(emptyProposals),
  parallel_tool_calls: false,
  status: 'completed',
  temperature: null,
  tool_choice: 'none',
  tools: [],
  top_p: null,
};

const address = {
  line1: '1 Main Street',
  line2: null,
  city: 'Lagos',
  region: null,
  postalCode: null,
  countryCode: 'ng',
};

const proposedCounterparty = {
  temporaryId: 'counterparty-1',
  name: ' Example Ltd ',
  type: 'organization',
  roles: ['employer', 'vendor', 'contractor'],
  roleDetails: {
    employer: { displayName: null, address },
    vendor: { address },
    contractor: { address },
  },
};

const proposedLine = {
  temporaryId: 'line-1',
  accountTemporaryId: 'account-1',
  sequenceOrder: 1,
  amount: { amount: 100, currencyCode: 'USD', isMinorUnit: true },
  exchangeRate: {
    baseCurrencyCode: 'USD',
    targetCurrencyCode: 'NGN',
    rate: 1500,
    type: 'official',
    asOf: '2026-11-17T00:00:00Z',
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
};

const proposedEntry = {
  temporaryId: 'entry-1',
  sourceType: 'payment',
  memo: null,
  effectiveDate: '2026-11-17',
  lines: [proposedLine],
};

/** Checks the provider contract for every nested JSON Schema object. */
function expectClosedObjects(schema: unknown): void {
  const isPrimitive = typeof schema !== 'object' || schema === null;
  if (isPrimitive) {
    return;
  }

  if ('type' in schema && schema.type === 'object') {
    expect(schema).toHaveProperty('additionalProperties', false);
    expect(schema).toHaveProperty('properties');
    if ('properties' in schema) {
      expect(schema).toHaveProperty(
        'required',
        expect.arrayContaining(Object.keys(schema.properties as object))
      );
    }
  }

  for (const child of Object.values(schema)) {
    expectClosedObjects(child);
  }
}

describe('OpenAI journal-entry proposer', () => {
  const createResponse = jest.mocked(openAiClient.responses.create);
  const getDownloadUrl = mockFileStorageClient.getDownloadUrl;
  const downloadUrl = 'https://example.com/source?signature=test';
  const journalEntryLlmProposer = makeJournalEntryLlmProposer(
    mockFileStorageClient
  );

  beforeEach(() => {
    createResponse.mockReset().mockResolvedValue(providerResponse);
    getDownloadUrl.mockReset().mockResolvedValue(downloadUrl);
  });

  it('sends source text with a strict schema and returns proposals', async () => {
    const value = 'No transactions in this document.';

    await expect(journalEntryLlmProposer({ value })).resolves.toEqual(
      emptyProposals
    );

    expect(createResponse).toHaveBeenCalledTimes(1);
    expect(getDownloadUrl).not.toHaveBeenCalled();
    expect(createResponse).toHaveBeenCalledWith({
      model: 'gpt-5.5',
      instructions: expect.stringContaining('__undetermined__'),
      input: [{ role: 'user', content: [{ type: 'input_text', text: value }] }],
      text: {
        format: {
          type: 'json_schema',
          name: 'journal_entry_extraction',
          strict: true,
          schema: expect.any(Object),
        },
      },
    });

    const request = createResponse.mock.calls[0][0];
    const format = request?.text?.format;
    expect(format?.type).toBe('json_schema');
    if (format?.type === 'json_schema') {
      expectClosedObjects(format.schema);
    }
  });

  it.each(['pdf', 'application/pdf', 'csv', 'text/csv', 'xls', 'xlsx'])(
    'sends a %s attachment as a file URL',
    async (type) => {
      const value = {
        url: 'https://example.com/source',
        name: 'source',
        type,
        size: 1024,
      };

      await journalEntryLlmProposer({ value });

      expect(getDownloadUrl).toHaveBeenCalledWith(value.url);
      expect(createResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          input: [
            {
              role: 'user',
              content: [{ type: 'input_file', file_url: downloadUrl }],
            },
          ],
        })
      );
    }
  );

  it.each(['jpg', 'jpeg', 'image/jpeg', 'png', 'image/png'])(
    'sends a %s attachment as an image URL',
    async (type) => {
      const value = {
        url: 'https://example.com/receipt',
        name: 'receipt',
        type,
        size: 1024,
      };

      await journalEntryLlmProposer({ value });

      expect(getDownloadUrl).toHaveBeenCalledWith(value.url);
      expect(createResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          input: [
            {
              role: 'user',
              content: [
                {
                  type: 'input_image',
                  image_url: downloadUrl,
                  detail: 'auto',
                },
              ],
            },
          ],
        })
      );
    }
  );

  it('propagates signing failures before calling the provider', async () => {
    const signingError = new Error('signing failed');
    getDownloadUrl.mockRejectedValue(signingError);

    await expect(
      journalEntryLlmProposer({
        value: {
          url: 'https://example.com/receipt',
          name: 'receipt.png',
          type: 'png',
          size: 1024,
        },
      })
    ).rejects.toBe(signingError);

    expect(createResponse).not.toHaveBeenCalled();
  });

  it('validates and normalizes counterparties, dates, money, and references', async () => {
    const proposals = {
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
          evidence: ['Statement header'],
        },
      ],
      counterparties: [
        { value: proposedCounterparty, confidence: 0.9, evidence: [] },
      ],
      entries: [{ value: proposedEntry, confidence: 1, evidence: ['Row 1'] }],
    };
    createResponse.mockResolvedValue({
      ...providerResponse,
      output_text: JSON.stringify(proposals),
    });

    const proposalResponse = await journalEntryLlmProposer({
      value: 'Statement text',
    });

    expect(proposalResponse).toEqual({
      ...proposals,
      counterparties: [
        {
          ...proposals.counterparties[0],
          value: {
            ...proposedCounterparty,
            name: 'Example Ltd',
            roleDetails: {
              employer: {
                displayName: null,
                address: { ...address, countryCode: 'NG' },
              },
              vendor: { address: { ...address, countryCode: 'NG' } },
              contractor: { address: { ...address, countryCode: 'NG' } },
            },
          },
        },
      ],
      entries: [
        {
          ...proposals.entries[0],
          value: {
            ...proposedEntry,
            lines: [
              {
                ...proposedLine,
                exchangeRate: {
                  ...proposedLine.exchangeRate,
                  asOf: new Date(proposedLine.exchangeRate.asOf),
                },
              },
            ],
          },
        },
      ],
    });
  });

  it('translates null role details to absent optional values', async () => {
    createResponse.mockResolvedValue({
      ...providerResponse,
      output_text: JSON.stringify({
        ...emptyProposals,
        counterparties: [
          {
            value: {
              ...proposedCounterparty,
              roles: [],
              roleDetails: {
                employer: null,
                vendor: null,
                contractor: null,
              },
            },
            confidence: 0.5,
            evidence: [],
          },
        ],
      }),
    });

    const proposalResponse = await journalEntryLlmProposer({ value: '' });

    expect(proposalResponse.counterparties).toEqual([
      expect.objectContaining({
        value: expect.objectContaining({ roleDetails: {} }),
      }),
    ]);
  });

  it.each([null, '__undetermined__'])(
    'preserves an exchange rate of %s',
    async (exchangeRate) => {
      const entry = {
        ...proposedEntry,
        lines: [{ ...proposedLine, exchangeRate }],
      };
      const proposals = {
        ...emptyProposals,
        entries: [{ value: entry, confidence: 1, evidence: [] }],
      };
      createResponse.mockResolvedValue({
        ...providerResponse,
        output_text: JSON.stringify(proposals),
      });

      await expect(journalEntryLlmProposer({ value: '' })).resolves.toEqual(
        proposals
      );
    }
  );

  it.each(['ledgerAccounts', 'counterparties', 'entries'])(
    'preserves an undetermined assessment in %s',
    async (collection) => {
      const proposals = {
        ...emptyProposals,
        [collection]: [
          { value: '__undetermined__', confidence: 0, evidence: [] },
        ],
      };
      createResponse.mockResolvedValue({
        ...providerResponse,
        output_text: JSON.stringify(proposals),
      });

      await expect(journalEntryLlmProposer({ value: '' })).resolves.toEqual(
        proposals
      );
    }
  );

  it.each([
    'incomplete',
    'failed',
    'cancelled',
    'in_progress',
    'queued',
  ] as const)(
    'rejects a %s response even when it contains valid JSON',
    async (status) => {
      createResponse.mockResolvedValue({ ...providerResponse, status });

      await expect(journalEntryLlmProposer({ value: '' })).rejects.toEqual(
        new journalEntryAppError.ExtractionUnexpected()
      );
    }
  );

  it.each([
    ['', 'empty or refusal-only output'],
    ['{', 'malformed JSON'],
    ['null', 'null output'],
    ['{}', 'missing collections'],
    [JSON.stringify({ ...emptyProposals, extra: true }), 'extra fields'],
    [
      JSON.stringify({
        ...emptyProposals,
        entries: [
          {
            value: {
              ...proposedEntry,
              lines: [
                {
                  ...proposedLine,
                  exchangeRate: {
                    ...proposedLine.exchangeRate,
                    asOf: 'not-a-date',
                  },
                },
              ],
            },
            confidence: 1,
            evidence: [],
          },
        ],
      }),
      'an invalid exchange-rate timestamp',
    ],
  ])('rejects %s (%s)', async (output_text) => {
    createResponse.mockResolvedValue({ ...providerResponse, output_text });

    await expect(journalEntryLlmProposer({ value: '' })).rejects.toEqual(
      new journalEntryAppError.ExtractionUnexpected()
    );
  });

  it('rejects invalid attachments before contacting OpenAI', async () => {
    await expect(
      journalEntryLlmProposer({
        value: {
          url: 'https://example.com/receipt',
          name: 'receipt',
          type: 'unsupported',
          size: 1024,
        },
      })
    ).rejects.toMatchObject({ name: 'ZodError' });
    expect(createResponse).not.toHaveBeenCalled();
  });

  it('propagates provider failures unchanged', async () => {
    const error = new Error('OpenAI unavailable');
    createResponse.mockRejectedValue(error);

    await expect(journalEntryLlmProposer({ value: '' })).rejects.toBe(error);
  });
});
