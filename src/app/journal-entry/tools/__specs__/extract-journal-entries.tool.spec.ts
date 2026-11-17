import journalEntryAppError from '@app/journal-entry/errors/journal-entry.error';
import makeExtractJournalEntriesTool from '@app/journal-entry/tools/extract-journal-entries.tool';

type TStructuredLlmCall = Parameters<
  typeof makeExtractJournalEntriesTool
>[0]['structuredLlmCall'];

describe('extract journal entries tool', () => {
  const structuredLlmCall = jest.fn<
    ReturnType<TStructuredLlmCall>,
    Parameters<TStructuredLlmCall>
  >();

  beforeEach(() => jest.resetAllMocks());

  it('passes parsed input to the extractor and returns application data', async () => {
    const extraction = { ledgerAccounts: [], counterparties: [], entries: [] };
    structuredLlmCall.mockResolvedValue(extraction);
    const tool = makeExtractJournalEntriesTool({ structuredLlmCall });
    const input = tool.inputSchema.parse({ value: 'Receipt text' });

    await expect(tool.func(input)).resolves.toBe(extraction);
    expect(structuredLlmCall).toHaveBeenCalledTimes(1);
    expect(structuredLlmCall).toHaveBeenCalledWith(input);
  });

  it('propagates extraction failures to its caller', async () => {
    const error = new journalEntryAppError.ExtractionUnexpected();
    structuredLlmCall.mockRejectedValue(error);
    const tool = makeExtractJournalEntriesTool({ structuredLlmCall });

    await expect(tool.func({ value: 'Receipt text' })).rejects.toBe(error);
  });
});
