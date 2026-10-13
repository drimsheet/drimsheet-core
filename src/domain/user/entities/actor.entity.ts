import { TEntityId } from '@shared/types/uuid';
import deepFreeze from '@shared/utils/deep-freeze';
import stringUtils from '@shared/utils/string';
import generateUUID from '@shared/utils/uuid-generator';
import { TAuditedEntity } from '@shared/values/events/types/event.types';

import getAgentNameHelper from '@domain/user/entities/helpers/get-agent-name.helper';
import actorValidation from '@domain/user/entities/validations/actor.validation';
import actorError from '@domain/user/errors/actor.error';
import actorEvents from '@domain/user/events/actor.events';
import {
  EActorStatus,
  EActorType,
  IActor,
} from '@domain/user/types/actor.types';
import { IUser } from '@domain/user/types/user.types';
import actorAudit from '@domain/user/values/actor-audit.vo';
import emailValue from '@domain/user/values/email.vo';

type TIdentity = Pick<
  IActor,
  'type' | 'username' | 'displayName' | 'ownerActorId' | 'agentName'
>;

/** Builds one immutable identity; null creator is reserved for explicit self-registration. */
function create(
  identity: TIdentity,
  creator: TEntityId | null
): TAuditedEntity<IActor, IActor, IActor> {
  const id = generateUUID();
  const timestamp = new Date();
  const actor: IActor = deepFreeze({
    id,
    type: identity.type,
    username: identity.username,
    displayName: stringUtils.sanitizeAndValidate(
      identity.displayName,
      { min: 1, max: 319 },
      actorError.InvalidDisplayName
    ),
    ownerActorId: identity.ownerActorId,
    agentName: identity.agentName,
    status: EActorStatus.Active,
    createdBy: creator === null ? id : creator,
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  actorValidation.validate(actor);
  return [actor, [actorEvents.created(actor)], actorAudit.created(actor)];
}

function makeSystem(createdBy: TEntityId) {
  return create(
    {
      type: EActorType.System,
      username: 'drimsheet-core',
      displayName: 'Drimsheet Core',
      ownerActorId: null,
      agentName: null,
    },
    createdBy
  );
}

function makeMigration() {
  return create(
    {
      type: EActorType.Migration,
      username: 'drimsheet-migration',
      displayName: 'Drimsheet Migration',
      ownerActorId: null,
      agentName: null,
    },
    null
  );
}

function makeUser(payload: { email: string; displayName: string }) {
  return create(
    {
      type: EActorType.User,
      username: emailValue.make(payload.email),
      displayName: payload.displayName,
      ownerActorId: null,
      agentName: null,
    },
    null
  );
}

function makeAgent(payload: {
  createdBy: TEntityId;
  user?: IUser;
  name?: string;
}) {
  if ('user' in payload) {
    actorValidation.validateOwner(payload.user!);
    if (typeof payload.name !== 'string') {
      throw new actorError.InvalidAgentName();
    }
    const name = getAgentNameHelper(payload.name);
    return create(
      {
        type: EActorType.AiAgent,
        username: `${emailValue.make(payload.user!.email)}/${name}`,
        displayName: payload.name.trim(),
        ownerActorId: payload.user!.actorId,
        agentName: name,
      },
      payload.createdBy
    );
  }
  if (payload.name !== undefined) {
    throw new actorError.InvalidAgentName();
  }
  return create(
    {
      type: EActorType.AiAgent,
      username: 'drimsheet-core-ai',
      displayName: 'Drimsheet AI',
      ownerActorId: null,
      agentName: null,
    },
    payload.createdBy
  );
}

const actorEntity = Object.freeze({
  makeSystem,
  makeMigration,
  makeUser,
  makeAgent,
  ...actorValidation,
});
export default actorEntity;
