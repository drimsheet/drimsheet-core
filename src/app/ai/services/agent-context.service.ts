import stringUtils from '@shared/utils/string';
import generateUUID from '@shared/utils/uuid-generator';

import IAccountingEntityRepo from '@domain/accounting/repos/accounting-entity.repo';
import actorError from '@domain/user/errors/actor.error';
import IActorRepo from '@domain/user/repos/actor.repo';
import { EActorStatus, EActorType } from '@domain/user/types/actor.types';

import accountingAppError from '@app/accounting/errors/accounting.error';
import IRunContextRepo from '@app/ai/contracts/repos/run-context.repo.contract';
import IAgentContextAppService from '@app/ai/contracts/services/agent-context.service.contract';
import agentContextAppError from '@app/ai/errors/agent-context.error';
import { IAgentRunContext } from '@app/ai/types/agent-run-context.types';

interface IDependencies {
  actorRepo: IActorRepo;
  accountingEntityRepo: IAccountingEntityRepo;
  runContextRepo: IRunContextRepo;
}

/**
 * Resolves the accounting entity and actors for a new run. Rejects an
 * invalid correlation ID, missing records, or an ineligible agent actor.
 */
function makeCreateRunContext(
  deps: IDependencies
): IAgentContextAppService['createRunContext'] {
  return async (input, repoOptions) => {
    const initiatedOn = new Date();

    stringUtils.validateUUID(
      input.correlationId,
      agentContextAppError.InvalidCorrelationId
    );

    const accountingEntity = await deps.accountingEntityRepo.findById(
      input.accountingEntityId,
      repoOptions
    );

    if (!accountingEntity) {
      throw new accountingAppError.EntityNotFound();
    }

    const delegatingActor = await deps.actorRepo.findById(
      input.delegatingActorId,
      repoOptions
    );

    if (!delegatingActor) {
      throw new actorError.NotFound();
    }

    const agentActor = await deps.actorRepo.findByUsername(
      input.agentActorUsername,
      repoOptions
    );

    if (!agentActor) {
      throw new actorError.NotFound();
    }

    if (agentActor.type !== EActorType.AiAgent) {
      throw new actorError.InvalidType();
    }

    if (agentActor.status === EActorStatus.Disabled) {
      throw new actorError.Disabled();
    }

    const context: IAgentRunContext = {
      id: generateUUID(),
      accountingEntityId: input.accountingEntityId,
      correlationId: input.correlationId,
      agentActor: {
        id: agentActor.id,
        name: agentActor.displayName,
      },
      delegatingActor: {
        name: delegatingActor.displayName,
        actorId: delegatingActor.id,
      },
      initiatedOn,
      completedOn: null,
    };

    await deps.runContextRepo.save(context);

    return context;
  };
}

/** Maps the run and actor identities to agent repository options. */
function makeGetAgentRepoOptions(): IAgentContextAppService['getAgentRepoOptions'] {
  return (context) => ({
    accountingEntityId: context.accountingEntityId,
    correlationId: context.correlationId,
    agentActor: {
      id: context.agentActor.id,
      name: context.agentActor.name,
    },
    delegatingActor: {
      id: context.delegatingActor.actorId,
      name: context.delegatingActor.name,
    },
    contextId: context.id,
  });
}

export default function makeAgentContextAppService(
  deps: IDependencies
): IAgentContextAppService {
  const service: IAgentContextAppService = {
    createRunContext: makeCreateRunContext(deps),
    getAgentRepoOptions: makeGetAgentRepoOptions(),
  };

  return Object.freeze(service);
}
