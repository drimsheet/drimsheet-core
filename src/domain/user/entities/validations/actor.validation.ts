import dateUtils from '@shared/utils/date';
import stringUtils from '@shared/utils/string';

import actorError from '@domain/user/errors/actor.error';
import {
  EActorStatus,
  EActorType,
  IActor,
} from '@domain/user/types/actor.types';
import { IUser } from '@domain/user/types/user.types';
import emailValue from '@domain/user/values/email.vo';

function validateAgentName(name: string): void {
  const isValid =
    typeof name === 'string' &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) &&
    name.length <= 64;
  if (!isValid) {
    throw new actorError.InvalidAgentName();
  }
}

function validateOwner(user: IUser): void {
  if (!user) {
    throw new actorError.InvalidOwner();
  }
  stringUtils.validateUUID(user.actorId, actorError.InvalidOwner);
  emailValue.validate(user.email);
  if (user.deletedAt !== null) {
    throw new actorError.InvalidOwner();
  }
}

function validate(actor: IActor): void {
  stringUtils.validateUUID(actor.id, actorError.InvalidId);
  stringUtils.validateUUID(actor.createdBy, actorError.InvalidCreatedBy);
  stringUtils.validateIsInEnum(actor.type, EActorType, actorError.InvalidType);
  stringUtils.validateIsInEnum(
    actor.status,
    EActorStatus,
    actorError.InvalidStatus
  );
  stringUtils.sanitizeAndValidate(
    actor.displayName,
    { min: 1, max: 319 },
    actorError.InvalidDisplayName
  );
  const isInvalidVersion =
    !Number.isInteger(actor.version) || actor.version < 1;
  if (isInvalidVersion) {
    throw new actorError.InvalidVersion();
  }
  dateUtils.validateDate(actor.createdAt, actorError.InvalidDate);
  dateUtils.validateDate(actor.updatedAt, actorError.InvalidDate);

  const isInvalidUsername =
    typeof actor.username !== 'string' ||
    actor.username.length > 319 ||
    actor.username !== actor.username.trim().toLowerCase();
  if (isInvalidUsername) {
    throw new actorError.InvalidUsername();
  }

  const isOwnedAgent =
    actor.type === EActorType.AiAgent && actor.ownerActorId !== null;
  if (isOwnedAgent) {
    stringUtils.validateUUID(actor.ownerActorId, actorError.InvalidOwner);
    validateAgentName(actor.agentName as string);
    const separator = actor.username.lastIndexOf('/');
    const isInvalidSuffix =
      separator < 1 || actor.username.slice(separator + 1) !== actor.agentName;
    if (isInvalidSuffix) {
      throw new actorError.InvalidUsername();
    }
    emailValue.validate(actor.username.slice(0, separator));
    return;
  }

  const hasUnexpectedOwner =
    actor.ownerActorId !== null || actor.agentName !== null;
  if (hasUnexpectedOwner) {
    throw new actorError.InvalidOwner();
  }

  if (actor.type === EActorType.User) {
    emailValue.validate(actor.username);
    return;
  }

  let expectedUsername = 'drimsheet-core-ai';
  if (actor.type === EActorType.System) {
    expectedUsername = 'drimsheet-core';
  } else if (actor.type === EActorType.Migration) {
    expectedUsername = 'drimsheet-migration';
  }

  if (actor.username !== expectedUsername) {
    throw new actorError.InvalidUsername();
  }
}

const actorValidation = Object.freeze({
  validate,
  validateAgentName,
  validateOwner,
});
export default actorValidation;
