import stringUtils from '@shared/utils/string';
import generateUUID from '@shared/utils/uuid-generator';

import IAccountingEntityRepo from '@domain/accounting/repos/accounting-entity.repo';
import actorError from '@domain/user/errors/actor.error';
import IActorRepo from '@domain/user/repos/actor.repo';
import { EActorStatus, EActorType } from '@domain/user/types/actor.types';

import accountingAppError from '@app/accounting/errors/accounting.error';
import IAgentContextService from '@app/ai/contracts/agent-run-context.service.contract';
import agentContextAppError from '@app/ai/errors/agent-context.error';

interface IDependencies {
  actorRepo: IActorRepo;
  accountingEntityRepo: IAccountingEntityRepo;
}

/**
 * Resolves the accounting entity and actors for an existing run. Rejects an
 * invalid correlation ID, missing records, or an ineligible agent actor.
 */
function makeCreateRunContext(
  deps: IDependencies
): IAgentContextService['createRunContext'] {
  return async (input, repoOptions) => {
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

    const delegatingActor = await deps.actorRepo.findByUsername(
      input.delegatingActorUsername,
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

    return {
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
      initiatedOn: input.initiatedOn,
      completedOn: null,
    };
  };
}

export default function makeAgentContextAppService(
  deps: IDependencies
): IAgentContextService {
  const service: IAgentContextService = {
    createRunContext: makeCreateRunContext(deps),
  };

  return Object.freeze(service);
}
