import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import actorEntity from '@domain/user/entities/actor.entity';
import actorError from '@domain/user/errors/actor.error';
import { EActorStatus } from '@domain/user/types/actor.types';

import { mockAccountingEntityRepo } from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import accountingAppError from '@app/accounting/errors/accounting.error';
import mockAgentRunContextRepo from '@app/ai/contracts/repos/__mocks__/agent-run-context.repo.mock';
import agentContextAppError from '@app/ai/errors/agent-context.error';
import makeAgentContextAppService from '@app/ai/services/agent-context.service';
import { mockActorRepo } from '@app/user/contracts/__mocks__/user.repos.mock';

describe('agentContextAppService', () => {
  const [delegatingActor] = actorEntity.makeUser({
    email: 'owner@example.com',
    displayName: 'Business owner',
  });
  const [agentActor] = actorEntity.makeAgent({ createdBy: delegatingActor.id });
  const [accountingEntity] = accountingEntityEntity.make({
    createdBy: delegatingActor.id,
    ownerId: delegatingActor.id,
    name: 'Business',
    type: 'sole_trader',
    functionalCurrencyCode: 'NGN',
    jurisdictionCode: 'NG',
  });
  const initiatedOn = new Date('2026-11-20T10:00:00.000Z');
  const input = {
    accountingEntityId: accountingEntity.id,
    correlationId: generateUUID(),
    agentActorUsername: agentActor.username,
    delegatingActorId: delegatingActor.id,
  };
  const repoOptions = { correlationId: input.correlationId };
  const service = makeAgentContextAppService({
    actorRepo: mockActorRepo,
    accountingEntityRepo: mockAccountingEntityRepo,
    agentRunContextRepo: mockAgentRunContextRepo,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers({ now: initiatedOn });
    mockAccountingEntityRepo.findById.mockResolvedValue(accountingEntity);
    mockActorRepo.findById.mockResolvedValue(delegatingActor);
    mockActorRepo.findByUsername.mockResolvedValue(agentActor);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('builds a new run context for the resolved actors', async () => {
    const context = await service.createRunContext(input, repoOptions);

    expect(mockAccountingEntityRepo.findById).toHaveBeenCalledWith(
      input.accountingEntityId,
      repoOptions
    );
    expect(mockActorRepo.findById).toHaveBeenCalledWith(
      input.delegatingActorId,
      repoOptions
    );
    expect(mockActorRepo.findByUsername).toHaveBeenCalledWith(
      input.agentActorUsername,
      repoOptions
    );
    expect(context).toEqual({
      id: expect.any(String),
      accountingEntityId: input.accountingEntityId,
      correlationId: input.correlationId,
      agentActor: { id: agentActor.id, name: agentActor.displayName },
      delegatingActor: {
        actorId: delegatingActor.id,
        name: delegatingActor.displayName,
      },
      initiatedOn,
      completedOn: null,
    });
    expect(mockAgentRunContextRepo.create).toHaveBeenCalledWith(context);
  });

  it('maps an agent run context to repository options', () => {
    const contextId = generateUUID();
    const agentRepoOptions = service.getAgentRepoOptions({
      id: contextId,
      accountingEntityId: input.accountingEntityId,
      correlationId: input.correlationId,
      agentActor: { id: agentActor.id, name: agentActor.displayName },
      delegatingActor: {
        actorId: delegatingActor.id,
        name: delegatingActor.displayName,
      },
      initiatedOn,
      completedOn: null,
    });

    expect(agentRepoOptions).toEqual({
      accountingEntityId: input.accountingEntityId,
      correlationId: input.correlationId,
      agentActor: { id: agentActor.id, name: agentActor.displayName },
      delegatingActor: {
        id: delegatingActor.id,
        name: delegatingActor.displayName,
      },
      contextId,
    });
  });

  it('rejects an invalid correlation ID before reading repositories', async () => {
    await expect(
      service.createRunContext(
        { ...input, correlationId: 'invalid' as TEntityId },
        repoOptions
      )
    ).rejects.toBeInstanceOf(agentContextAppError.InvalidCorrelationId);
    expect(mockAccountingEntityRepo.findById).not.toHaveBeenCalled();
    expect(mockActorRepo.findById).not.toHaveBeenCalled();
  });

  it('rejects a missing accounting entity', async () => {
    mockAccountingEntityRepo.findById.mockResolvedValue(null);

    await expect(
      service.createRunContext(input, repoOptions)
    ).rejects.toBeInstanceOf(accountingAppError.EntityNotFound);
    expect(mockActorRepo.findById).not.toHaveBeenCalled();
  });

  it('rejects a missing delegating actor', async () => {
    mockActorRepo.findById.mockResolvedValue(null);

    await expect(
      service.createRunContext(input, repoOptions)
    ).rejects.toBeInstanceOf(actorError.NotFound);
    expect(mockActorRepo.findByUsername).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', null, actorError.NotFound],
    ['the wrong type', delegatingActor, actorError.InvalidType],
    [
      'disabled',
      { ...agentActor, status: EActorStatus.Disabled },
      actorError.Disabled,
    ],
  ] as const)('rejects an agent actor that is %s', async (_, actor, error) => {
    mockActorRepo.findByUsername.mockResolvedValue(actor);

    await expect(
      service.createRunContext(input, repoOptions)
    ).rejects.toBeInstanceOf(error);
  });
});
