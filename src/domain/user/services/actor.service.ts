import actorError from '@domain/user/errors/actor.error';
import IActorRepo from '@domain/user/repos/actor.repo';
import IActorService from '@domain/user/types/actor.service.types';
import {
  EActorStatus,
  EActorType,
  IActor,
} from '@domain/user/types/actor.types';

interface IDependencies {
  actorRepo: IActorRepo;
}

function requireActive(actor: IActor | null): IActor {
  if (!actor) {
    throw new actorError.NotFound();
  }
  if (actor.status !== EActorStatus.Active) {
    throw new actorError.Disabled();
  }
  return actor;
}

/** Resolves a persisted human identity and rejects inconsistent user links. */
function makeResolveUser(deps: IDependencies): IActorService['resolveUser'] {
  return async (user, options) => {
    const actor = requireActive(
      await deps.actorRepo.findById(user.actorId, options)
    );
    const hasInvalidLink =
      actor.type !== EActorType.User ||
      actor.id !== user.actorId ||
      actor.username !== user.email;
    if (hasInvalidLink) {
      throw new actorError.InvalidUserLink();
    }
    return actor;
  };
}

/** Resolves a named identity for trusted workflows, without creating missing actors. */
function makeResolveByUsername(
  deps: IDependencies
): IActorService['resolveByUsername'] {
  return async (username, options) =>
    requireActive(
      await deps.actorRepo.findByUsername(
        username.trim().toLowerCase(),
        options
      )
    );
}

export default function makeActorService(deps: IDependencies): IActorService {
  return Object.freeze({
    resolveUser: makeResolveUser(deps),
    resolveByUsername: makeResolveByUsername(deps),
  });
}
