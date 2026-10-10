import { randomUUID } from 'node:crypto';

import jsonWebToken, {
  JsonWebTokenError,
  NotBeforeError,
  TokenExpiredError,
} from 'jsonwebtoken';

import { ICacheStorage } from '@shared/contracts/cache-storage.contract';

import ITokenAppService, {
  IAuthTokenPayload,
  IPasswordResetTokenClaim,
} from '@app/auth/contracts/token-service.contract';
import authError from '@app/auth/errors/auth.error';

interface IDependencies {
  cacheStorage: ICacheStorage;
  secret: string;
}

/** Signs an auth token with the configured algorithm and lifetime. */
function encodeToken(
  deps: IDependencies,
  payload: Record<string, unknown>,
  expiresInSeconds: number,
  tokenId?: string
) {
  return jsonWebToken.sign(payload, deps.secret, {
    algorithm: 'HS256',
    expiresIn: expiresInSeconds,
    ...(tokenId ? { jwtid: tokenId } : {}),
  });
}

/**
 * Verifies and decodes an auth token, mapping JWT failures to stable auth
 * errors.
 */
function verifyAuthToken(deps: IDependencies, token: string) {
  try {
    return jsonWebToken.verify(token, deps.secret, {
      algorithms: ['HS256'],
    }) as IAuthTokenPayload & { exp?: number; type: string };
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      throw new authError.ExpiredToken();
    }
    if (error instanceof NotBeforeError) {
      throw new authError.InvalidToken();
    }
    if (error instanceof JsonWebTokenError) {
      throw new authError.MalformedToken();
    }

    throw new authError.InvalidToken();
  }
}

/** Claims a valid cached signup token for one verification attempt. */
async function claimSignupToken(deps: IDependencies, token: string) {
  const decoded = verifyAuthToken(deps, token);

  if (decoded.type !== 'signup' || !decoded.id) {
    throw new authError.InvalidToken();
  }

  const cachedToken = await deps.cacheStorage.get<string>(
    `app:auth:signup-token:${decoded.id}`
  );

  if (!cachedToken || cachedToken !== token) {
    throw new authError.InvalidToken();
  }

  const claimed = await deps.cacheStorage.setIfNotExists(
    `app:auth:signup-token-claim:${decoded.id}`,
    token,
    30
  );

  if (!claimed) {
    throw new authError.InvalidToken();
  }

  return decoded;
}

/** Removes a consumed signup token and its claim. */
async function finalizeSignupToken(deps: IDependencies, id: string) {
  await deps.cacheStorage.del(`app:auth:signup-token:${id}`);
  await deps.cacheStorage.del(`app:auth:signup-token-claim:${id}`);
}

/** Claims a valid cached password-reset token until its token expiry. */
async function claimPasswordResetToken(
  deps: IDependencies,
  token: string
): Promise<IPasswordResetTokenClaim> {
  const decoded = verifyAuthToken(deps, token);

  if (decoded.type !== 'reset' || !decoded.id) {
    throw new authError.InvalidToken();
  }

  const cachedToken = await deps.cacheStorage.get<string>(
    `app:auth:reset-token:${decoded.id}`
  );

  if (!cachedToken || cachedToken !== token) {
    throw new authError.InvalidToken();
  }

  const owner = randomUUID();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const claimTtlSeconds = Math.max(
    1,
    (decoded.exp ?? nowSeconds + 1) - nowSeconds
  );
  const claimed = await deps.cacheStorage.setIfNotExists(
    `app:auth:reset-token-claim:${decoded.id}`,
    owner,
    claimTtlSeconds
  );

  if (!claimed) {
    throw new authError.InvalidToken();
  }

  return { id: decoded.id, owner };
}

/** Removes a password-reset token only when the caller owns its claim. */
async function finalizePasswordResetToken(
  deps: IDependencies,
  claim: IPasswordResetTokenClaim
) {
  await deps.cacheStorage.deleteIfValueMatches(
    `app:auth:reset-token-claim:${claim.id}`,
    claim.owner,
    [`app:auth:reset-token:${claim.id}`]
  );
}

/** Creates the capability that generates and caches a signup token. */
function makeGenerateSignupToken(
  deps: IDependencies
): ITokenAppService['generateSignupToken'] {
  return async ({ id }) => {
    const token = encodeToken(
      deps,
      {
        id,
        type: 'signup',
      },
      60 * 60 * 24
    );

    await deps.cacheStorage.set(
      `app:auth:signup-token:${id}`,
      token,
      60 * 60 * 24
    );
    return token;
  };
}

/**
 * Creates the capability that claims and immediately consumes a signup token.
 */
function makeVerifySignupToken(
  deps: IDependencies
): ITokenAppService['verifySignupToken'] {
  return async (token) => {
    const decoded = await claimSignupToken(deps, token);
    await finalizeSignupToken(deps, decoded.id);
    return decoded;
  };
}

/** Creates the capability that claims a cached signup token. */
function makeClaimSignupToken(
  deps: IDependencies
): ITokenAppService['claimSignupToken'] {
  return (token) => claimSignupToken(deps, token);
}

/** Creates the capability that finalizes a claimed signup token. */
function makeFinalizeSignupToken(
  deps: IDependencies
): ITokenAppService['finalizeSignupToken'] {
  return (id) => finalizeSignupToken(deps, id);
}

/** Creates the capability that releases a signup-token claim. */
function makeReleaseSignupTokenClaim(
  deps: IDependencies
): ITokenAppService['releaseSignupTokenClaim'] {
  return async (id) => {
    await deps.cacheStorage.del(`app:auth:signup-token-claim:${id}`);
  };
}

/** Creates the capability that generates a short-lived access token. */
function makeGenerateAccessToken(
  deps: IDependencies
): ITokenAppService['generateAccessToken'] {
  return async ({ id }) => {
    const ttlSeconds = 60 * 15; // 15 minutes
    return encodeToken(deps, { id, type: 'access' }, ttlSeconds, randomUUID());
  };
}

/** Creates the capability that generates a refresh token. */
function makeGenerateRefreshToken(
  deps: IDependencies
): ITokenAppService['generateRefreshToken'] {
  return async ({ id }) => {
    const ttlSeconds = 60 * 60 * 24 * 15; // 15 days
    return encodeToken(
      deps,
      {
        id,
        type: 'refresh',
      },
      ttlSeconds,
      randomUUID()
    );
  };
}

/** Creates the capability that verifies and decodes a refresh token. */
function makeVerifyRefreshToken(
  deps: IDependencies
): ITokenAppService['verifyRefreshToken'] {
  return (token) => {
    const { type, ...decoded } = verifyAuthToken(deps, token);

    if (type !== 'refresh') {
      throw new authError.InvalidToken();
    }

    return decoded;
  };
}

/** Creates the capability that generates and caches a password-reset token. */
function makeGeneratePasswordResetToken(
  deps: IDependencies
): ITokenAppService['generatePasswordResetToken'] {
  return async ({ id }) => {
    const ttlSeconds = 2 * 60 * 60; // 2 hours
    const token = encodeToken(
      deps,
      {
        id,
        type: 'reset',
      },
      ttlSeconds
    );
    await deps.cacheStorage.set(
      `app:auth:reset-token:${id}`,
      token,
      ttlSeconds
    );

    return token;
  };
}

/**
 * Creates the capability that claims and immediately consumes a password-reset
 * token.
 */
function makeVerifyPasswordResetToken(
  deps: IDependencies
): ITokenAppService['verifyPasswordResetToken'] {
  return async (token) => {
    const decoded = await claimPasswordResetToken(deps, token);
    await finalizePasswordResetToken(deps, decoded);
    return decoded;
  };
}

/** Creates the capability that claims a cached password-reset token. */
function makeClaimPasswordResetToken(
  deps: IDependencies
): ITokenAppService['claimPasswordResetToken'] {
  return (token) => claimPasswordResetToken(deps, token);
}

/** Creates the capability that finalizes an owned password-reset claim. */
function makeFinalizePasswordResetToken(
  deps: IDependencies
): ITokenAppService['finalizePasswordResetToken'] {
  return (claim) => finalizePasswordResetToken(deps, claim);
}

/** Creates the capability that releases an owned password-reset claim. */
function makeReleasePasswordResetTokenClaim(
  deps: IDependencies
): ITokenAppService['releasePasswordResetTokenClaim'] {
  return async (claim) => {
    await deps.cacheStorage.deleteIfValueMatches(
      `app:auth:reset-token-claim:${claim.id}`,
      claim.owner
    );
  };
}

/** Creates the capability that verifies an access token's authenticated user. */
function makeGetAuthUser(deps: IDependencies): ITokenAppService['getAuthUser'] {
  return async (token) => {
    const decoded = verifyAuthToken(deps, token);

    if (decoded.type !== 'access') {
      throw new authError.InvalidToken();
    }

    return decoded;
  };
}

/** Composes the immutable token service from its capabilities. */
export default function makeTokenAppService(
  deps: IDependencies
): ITokenAppService {
  const service: ITokenAppService = {
    generateSignupToken: makeGenerateSignupToken(deps),
    verifySignupToken: makeVerifySignupToken(deps),
    claimSignupToken: makeClaimSignupToken(deps),
    finalizeSignupToken: makeFinalizeSignupToken(deps),
    releaseSignupTokenClaim: makeReleaseSignupTokenClaim(deps),
    generateAccessToken: makeGenerateAccessToken(deps),
    generateRefreshToken: makeGenerateRefreshToken(deps),
    verifyRefreshToken: makeVerifyRefreshToken(deps),
    generatePasswordResetToken: makeGeneratePasswordResetToken(deps),
    verifyPasswordResetToken: makeVerifyPasswordResetToken(deps),
    claimPasswordResetToken: makeClaimPasswordResetToken(deps),
    finalizePasswordResetToken: makeFinalizePasswordResetToken(deps),
    releasePasswordResetTokenClaim: makeReleasePasswordResetTokenClaim(deps),
    getAuthUser: makeGetAuthUser(deps),
  };

  return Object.freeze(service);
}
