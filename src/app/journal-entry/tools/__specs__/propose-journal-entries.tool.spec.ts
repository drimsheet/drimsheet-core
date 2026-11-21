import generateUUID from '@shared/utils/uuid-generator';

import agentContextAppError from '@app/ai/errors/agent-context.error';
import makeProposeJournalEntriesTool from '@app/journal-entry/tools/propose-journal-entries.tool';

type TUseCase = Parameters<typeof makeProposeJournalEntriesTool>[0]['usecase'];

describe('propose journal entries tool', () => {
  const usecase = jest.fn<ReturnType<TUseCase>, Parameters<TUseCase>>();
  const contextId = generateUUID();
  const file = {
    url: 'https://example.com/receipt.pdf',
    name: 'receipt.pdf',
    type: 'pdf',
    size: 1024,
  };
  const proposals = { ledgerAccounts: [], counterparties: [], entries: [] };
  const tool = makeProposeJournalEntriesTool({
    usecase,
    contextId,
    file,
  });

  beforeEach(() => jest.resetAllMocks());

  it('passes the bound file and run context to the use case', async () => {
    const extraction = { ...proposals, sourceFile: file };
    usecase.mockResolvedValue(extraction);
    const input = tool.inputSchema.parse({});

    expect(tool.name).toBe('propose_journal_entries');
    await expect(tool.func(input)).resolves.toBe(extraction);
    expect(usecase).toHaveBeenCalledTimes(1);
    expect(usecase).toHaveBeenCalledWith(file, contextId);
  });

  it.each([{ contextId }, { file }, { proposals }])(
    'rejects attempts to replace bound values',
    (input) => {
      expect(tool.inputSchema.safeParse(input).success).toBe(false);
    }
  );

  it('propagates use-case failures to its caller', async () => {
    const error = new agentContextAppError.NotFound();
    usecase.mockRejectedValue(error);

    await expect(tool.func({})).rejects.toBe(error);
  });
});
