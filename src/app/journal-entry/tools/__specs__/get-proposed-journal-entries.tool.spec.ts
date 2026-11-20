import generateUUID from '@shared/utils/uuid-generator';

import agentContextAppError from '@app/ai/errors/agent-context.error';
import makeGetProposedJournalEntriesTool from '@app/journal-entry/tools/get-proposed-journal-entries.tool';

type TUseCase = Parameters<
  typeof makeGetProposedJournalEntriesTool
>[0]['usecase'];

describe('get proposed journal entries tool', () => {
  const usecase = jest.fn<ReturnType<TUseCase>, Parameters<TUseCase>>();
  const contextId = generateUUID();
  const tool = makeGetProposedJournalEntriesTool({ usecase, contextId });
  const payload = { value: 'Receipt text' };

  beforeEach(() => jest.resetAllMocks());

  it('passes parsed input and the run context ID to the use case', async () => {
    const proposals = { ledgerAccounts: [], counterparties: [], entries: [] };
    usecase.mockResolvedValue(proposals);
    const input = tool.inputSchema.parse(payload);

    await expect(tool.func(input)).resolves.toBe(proposals);
    expect(usecase).toHaveBeenCalledTimes(1);
    expect(usecase).toHaveBeenCalledWith(input, contextId);
  });

  it('rejects a run context ID in the tool input', () => {
    expect(tool.inputSchema.safeParse({ ...payload, contextId }).success).toBe(
      false
    );
  });

  it('propagates use-case failures to its caller', async () => {
    const error = new agentContextAppError.NotFound();
    usecase.mockRejectedValue(error);

    await expect(tool.func(payload)).rejects.toBe(error);
  });
});
