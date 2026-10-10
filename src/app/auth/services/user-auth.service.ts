import {
  EAuthStrategy,
  IUserAuth,
  UAuthStrategy,
} from '@app/auth/contracts/auth.types';
import IUserAuthAppService from '@app/auth/contracts/user-auth.service.contract';

/** Builds one immutable next-version authentication-state transition. */
function makeTransition(
  userAuth: IUserAuth,
  values: Pick<IUserAuth, 'password' | 'failedLoginAttempts' | 'strategy'>
): IUserAuth {
  return Object.freeze({
    userId: userAuth.userId,
    createdBy: userAuth.createdBy,
    password: values.password,
    failedLoginAttempts: values.failedLoginAttempts,
    strategy: Object.freeze([...values.strategy]) as UAuthStrategy[],
    version: userAuth.version + 1,
    createdAt: userAuth.createdAt,
    updatedAt: new Date(),
  });
}

/** Creates the capability that prepares initial version-one auth state. */
function makeUserAuth(): IUserAuthAppService['make'] {
  return (payload) => {
    const timestamp = new Date();

    return Object.freeze({
      userId: payload.userId,
      createdBy: payload.createdBy,
      password: payload.password,
      failedLoginAttempts: 0,
      strategy: Object.freeze([payload.strategy]) as UAuthStrategy[],
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  };
}

/**
 * Creates the capability that appends a missing authentication strategy and
 * preserves identity when the strategy already exists.
 */
function makeAddStrategy(): IUserAuthAppService['addStrategy'] {
  return (userAuth, strategy) => {
    if (userAuth.strategy.includes(strategy)) return userAuth;

    return makeTransition(userAuth, {
      password: userAuth.password,
      failedLoginAttempts: userAuth.failedLoginAttempts,
      strategy: [...userAuth.strategy, strategy],
    });
  };
}

/**
 * Creates the capability that replaces a password, restores email auth, and
 * resets failed-login attempts in the next version.
 */
function makeReplacePassword(): IUserAuthAppService['replacePassword'] {
  return (userAuth, password) => {
    const strategy = userAuth.strategy.includes(EAuthStrategy.Email)
      ? userAuth.strategy
      : [...userAuth.strategy, EAuthStrategy.Email];

    return makeTransition(userAuth, {
      password,
      failedLoginAttempts: 0,
      strategy,
    });
  };
}

/** Creates the capability that records one failed login in the next version. */
function makeRecordFailedLogin(): IUserAuthAppService['recordFailedLogin'] {
  return (userAuth) =>
    makeTransition(userAuth, {
      password: userAuth.password,
      failedLoginAttempts: userAuth.failedLoginAttempts + 1,
      strategy: userAuth.strategy,
    });
}

/**
 * Creates the capability that resets failed-login attempts, preserving
 * identity when the count is already zero.
 */
function makeResetFailedLoginAttempts(): IUserAuthAppService['resetFailedLoginAttempts'] {
  return (userAuth) => {
    if (userAuth.failedLoginAttempts === 0) return userAuth;

    return makeTransition(userAuth, {
      password: userAuth.password,
      failedLoginAttempts: 0,
      strategy: userAuth.strategy,
    });
  };
}

/** Composes the immutable user-auth service from its capabilities. */
export default function makeUserAuthAppService(): IUserAuthAppService {
  const service: IUserAuthAppService = {
    make: makeUserAuth(),
    addStrategy: makeAddStrategy(),
    replacePassword: makeReplacePassword(),
    recordFailedLogin: makeRecordFailedLogin(),
    resetFailedLoginAttempts: makeResetFailedLoginAttempts(),
  };

  return Object.freeze(service);
}
