import generateUUID from '@shared/utils/uuid-generator';

import mockAgentRunContextRepo from '@app/ai/contracts/repos/__mocks__/agent-run-context.repo.mock';
import mockAgentContextAppService from '@app/ai/contracts/services/__mocks__/agent-context.service.mock';
import agentContextAppError from '@app/ai/errors/agent-context.error';
import makeCreateAgentRunContextUsecase from '@app/ai/usecases/create-agent-run-context.usecase';

describe('create agent run context use case', () => {
  const createAgentRunContext = makeCreateAgentRunContextUsecase({
    agentContextAppService: mockAgentContextAppService,
    agentRunContextRepo: mockAgentRunContextRepo,
  });
  const input = {
    accountingEntityId: generateUUID(),
    correlationId: generateUUID(),
    delegatingActorId: generateUUID(),
    agentActorUsername: 'drimsheet-core-ai',
  };
  const context = {
    id: generateUUID(),
    accountingEntityId: input.accountingEntityId,
    correlationId: input.correlationId,
    agentActor: { id: generateUUID(), name: 'Drimsheet AI' },
    delegatingActor: { actorId: input.delegatingActorId, name: 'Uploader' },
    initiatedOn: new Date('2026-11-20T10:00:00.000Z'),
    completedOn: null,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    mockAgentContextAppService.createRunContext.mockResolvedValue(context);
    mockAgentRunContextRepo.create.mockResolvedValue(undefined);
  });

  it('persists the prepared context and returns it', async () => {
    await expect(createAgentRunContext(input)).resolves.toBe(context);

    expect(mockAgentContextAppService.createRunContext).toHaveBeenCalledWith(
      input,
      { correlationId: input.correlationId }
    );
    expect(mockAgentRunContextRepo.create).toHaveBeenCalledWith(context);
  });

  it('rejects an invalid correlation ID before preparing or writing the context', async () => {
    await expect(
      createAgentRunContext({ ...input, correlationId: 'invalid' })
    ).rejects.toMatchObject({
      name: 'UnprocessableEntity',
      validationErrors: [
        {
          field: 'correlationId',
          message: new agentContextAppError.InvalidCorrelationId().errorKey,
        },
      ],
    });
    expect(mockAgentContextAppService.createRunContext).not.toHaveBeenCalled();
    expect(mockAgentRunContextRepo.create).not.toHaveBeenCalled();
  });

  it('skips persistence if context preparation fails', async () => {
    const failure = new Error('Could not prepare context');
    mockAgentContextAppService.createRunContext.mockRejectedValue(failure);

    await expect(createAgentRunContext(input)).rejects.toBe(failure);
    expect(mockAgentRunContextRepo.create).not.toHaveBeenCalled();
  });

  it('propagates a repository write failure', async () => {
    const failure = new Error('Could not insert context');
    mockAgentRunContextRepo.create.mockRejectedValue(failure);

    await expect(createAgentRunContext(input)).rejects.toBe(failure);
  });
});
