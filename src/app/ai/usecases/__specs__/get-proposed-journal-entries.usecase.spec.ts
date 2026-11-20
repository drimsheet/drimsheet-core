import generateUUID from '@shared/utils/uuid-generator';
import appError from '@shared/values/errors/app.error';

import mockAgentRunContextRepo from '@app/ai/contracts/repos/__mocks__/agent-run-context.repo.mock';
import mockAgentContextAppService from '@app/ai/contracts/services/__mocks__/agent-context.service.mock';
import agentContextAppError from '@app/ai/errors/agent-context.error';
import makeGetProposedJournalEntriesUsecase from '@app/ai/usecases/get-proposed-journal-entries.usecase';

type TDependencies = Parameters<typeof makeGetProposedJournalEntriesUsecase>[0];

describe('get proposed journal entries use case', () => {
  const journalEntryProposalsRepo: jest.Mocked<
    TDependencies['journalEntryProposalsRepo']
  > = { save: jest.fn() };
  const structuredLlmCall: jest.MockedFunction<
    TDependencies['structuredLlmCall']
  > = jest.fn();
  const getProposedJournalEntries = makeGetProposedJournalEntriesUsecase({
    agentRunContextRepo: mockAgentRunContextRepo,
    agentContextAppService: mockAgentContextAppService,
    journalEntryProposalsRepo,
    structuredLlmCall,
  });
  const contextId = generateUUID();
  const payload = { value: 'Receipt total 100 NGN' };

  beforeEach(() => jest.resetAllMocks());

  it('saves and returns the extraction response for the run', async () => {
    const runContext = {
      id: contextId,
      accountingEntityId: generateUUID(),
      correlationId: generateUUID(),
      agentActor: { id: generateUUID(), name: 'Drimsheet AI' },
      delegatingActor: { actorId: generateUUID(), name: 'Uploader' },
      initiatedOn: new Date(),
      completedOn: null,
    };
    const repoOptions = {
      contextId,
      accountingEntityId: runContext.accountingEntityId,
      correlationId: runContext.correlationId,
      agentActor: runContext.agentActor,
      delegatingActor: {
        id: runContext.delegatingActor.actorId,
        name: 'Uploader',
      },
    };
    const proposals = { ledgerAccounts: [], counterparties: [], entries: [] };
    mockAgentRunContextRepo.findById.mockResolvedValue(runContext);
    mockAgentContextAppService.getAgentRepoOptions.mockReturnValue(repoOptions);
    structuredLlmCall.mockResolvedValue(proposals);
    journalEntryProposalsRepo.save.mockResolvedValue(undefined);

    await expect(getProposedJournalEntries(payload, contextId)).resolves.toBe(
      proposals
    );
    expect(mockAgentRunContextRepo.findById).toHaveBeenCalledWith(contextId);
    expect(structuredLlmCall).toHaveBeenCalledWith(payload);
    expect(mockAgentContextAppService.getAgentRepoOptions).toHaveBeenCalledWith(
      runContext
    );
    expect(journalEntryProposalsRepo.save).toHaveBeenCalledWith(
      proposals,
      repoOptions
    );
  });

  it('rejects an invalid payload before looking up the run context', async () => {
    const invalidPayload = { ...payload, unexpected: true };

    await expect(
      getProposedJournalEntries(invalidPayload, contextId)
    ).rejects.toBeInstanceOf(appError.UnprocessableEntity);
    expect(mockAgentRunContextRepo.findById).not.toHaveBeenCalled();
  });

  it('rejects a missing run context before extracting or saving', async () => {
    mockAgentRunContextRepo.findById.mockResolvedValue(null);

    await expect(
      getProposedJournalEntries(payload, contextId)
    ).rejects.toBeInstanceOf(agentContextAppError.NotFound);
    expect(structuredLlmCall).not.toHaveBeenCalled();
    expect(journalEntryProposalsRepo.save).not.toHaveBeenCalled();
  });
});
