import IHasher from '@shared/contracts/hasher.contract';

import IPasswordAppService from '@app/auth/contracts/password-service.contract';
import authError from '@app/auth/errors/auth.error';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  satisfiesPasswordComplexity,
} from '@app/auth/policies/password.policy';

interface IDependencies {
  hasher: IHasher;
}

/** Creates the capability that validates an accepted plain-text password. */
// TODO: Rename this factory to reflect its value-returning password check;
// reserve validate for checks that only throw on failure and return no value.
function makeValidatePassword(): IPasswordAppService['makePassword'] {
  return (input) => {
    if (
      typeof input !== 'string' ||
      input.length < PASSWORD_MIN_LENGTH ||
      input.length > PASSWORD_MAX_LENGTH ||
      !satisfiesPasswordComplexity(input)
    ) {
      throw new authError.InvalidPassword({ input });
    }

    return input;
  };
}

/** Creates the capability that hashes a validated password with a fresh salt. */
function makeHash(deps: IDependencies): IPasswordAppService['hash'] {
  return async (password) => {
    const salt = await deps.hasher.genSalt(10);
    return deps.hasher.hash(password, salt);
  };
}

/** Creates the capability that compares a plain-text password with its hash. */
function makeCompare(deps: IDependencies): IPasswordAppService['compare'] {
  return async (password, hashedPassword) =>
    deps.hasher.compare(password, hashedPassword);
}

/** Composes the immutable password service from its capabilities. */
export default function makePasswordAppService(deps: IDependencies) {
  const service: IPasswordAppService = {
    makePassword: makeValidatePassword(),
    hash: makeHash(deps),
    compare: makeCompare(deps),
  };

  return Object.freeze(service);
}
