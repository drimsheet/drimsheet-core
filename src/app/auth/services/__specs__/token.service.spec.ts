import jsonWebToken from 'jsonwebtoken';

import mockCacheStorage from '@shared/contracts/__mocks__/cache-storage.mock';
import { TEntityId } from '@shared/types/uuid';

import authError from '@app/auth/errors/auth.error';
import makeTokenAppService from '@app/auth/services/token.service';

interface ITokenPayload extends Record<string, unknown> {
  exp?: number;
  iat?: number;
  jti?: string;
}

const secret = 'test-secret';

const decodeToken = (token: string) =>
  jsonWebToken.decode(token) as ITokenPayload;

const expectTokenTtl = (token: string, ttlSeconds: number) => {
  const payload = decodeToken(token);

  expect(payload.iat).toEqual(expect.any(Number));
  expect(payload.exp).toEqual(expect.any(Number));
  expect((payload.exp as number) - (payload.iat as number)).toBe(ttlSeconds);
};

const configureCacheStorage = () => {
  const store = new Map<string, unknown>();

  mockCacheStorage.get
    .mockReset()
    .mockImplementation(async <T>(key: string) =>
      store.has(key) ? (store.get(key) as T) : null
    );
  mockCacheStorage.set
    .mockReset()
    .mockImplementation(async <T>(key: string, value: T) => {
      store.set(key, value);
    });
  mockCacheStorage.setIfNotExists
    .mockReset()
    .mockImplementation(async <T>(key: string, value: T) => {
      if (store.has(key)) return false;

      store.set(key, value);
      return true;
    });
  mockCacheStorage.deleteIfValueMatches
    .mockReset()
    .mockImplementation(
      async <T>(key: string, value: T, additionalKeys: string[] = []) => {
        if (store.get(key) !== value) return false;

        store.delete(key);
        additionalKeys.forEach((additionalKey) => store.delete(additionalKey));
        return true;
      }
    );
  mockCacheStorage.del.mockReset().mockImplementation(async (key: string) => {
    store.delete(key);
  });
};

describe('makeTokenAppService', () => {
  let tokenAppService: ReturnType<typeof makeTokenAppService>;

  beforeEach(() => {
    configureCacheStorage();

    tokenAppService = makeTokenAppService({
      cacheStorage: mockCacheStorage,
      secret,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe('generateSignupToken & verifySignupToken', () => {
    const userId = 'user-123' as TEntityId;

    it('should successfully generate and verify a signup token', async () => {
      const token = await tokenAppService.generateSignupToken({ id: userId });
      expect(mockCacheStorage.set).toHaveBeenCalledWith(
        `app:auth:signup-token:${userId}`,
        token,
        60 * 60 * 24
      );
      expectTokenTtl(token, 60 * 60 * 24);

      const decoded = await tokenAppService.verifySignupToken(token);
      expect(decoded.id).toBe(userId);

      // It should delete the token after successful verification
      expect(mockCacheStorage.del).toHaveBeenCalledWith(
        `app:auth:signup-token:${userId}`
      );
    });

    it('should claim and finalize a signup token separately', async () => {
      const token = await tokenAppService.generateSignupToken({ id: userId });

      await expect(
        tokenAppService.claimSignupToken(token)
      ).resolves.toMatchObject({ id: userId });
      expect(mockCacheStorage.setIfNotExists).toHaveBeenCalledWith(
        `app:auth:signup-token-claim:${userId}`,
        token,
        30
      );

      await tokenAppService.finalizeSignupToken(userId);

      expect(mockCacheStorage.del).toHaveBeenCalledWith(
        `app:auth:signup-token:${userId}`
      );
      expect(mockCacheStorage.del).toHaveBeenCalledWith(
        `app:auth:signup-token-claim:${userId}`
      );
    });

    it('should throw InvalidToken if token type is incorrect', async () => {
      const wrongToken = await tokenAppService.generateAccessToken({
        id: userId,
      });

      await expect(
        tokenAppService.verifySignupToken(wrongToken)
      ).rejects.toThrow(authError.InvalidToken);
    });

    it('should throw InvalidToken if token is missing from cache', async () => {
      const token = await tokenAppService.generateSignupToken({ id: userId });

      // Manually delete from cache to simulate expiry/consumption
      await mockCacheStorage.del(`app:auth:signup-token:${userId}`);

      await expect(tokenAppService.verifySignupToken(token)).rejects.toThrow(
        authError.InvalidToken
      );
    });

    it('should throw InvalidToken if cached token does not match provided token', async () => {
      const token = await tokenAppService.generateSignupToken({ id: userId });

      // Tamper with the cache
      await mockCacheStorage.set(
        `app:auth:signup-token:${userId}`,
        'some-other-token'
      );

      await expect(tokenAppService.verifySignupToken(token)).rejects.toThrow(
        authError.InvalidToken
      );
    });

    it('should throw InvalidToken if signup token is already claimed (concurrent claim)', async () => {
      const token = await tokenAppService.generateSignupToken({ id: userId });

      // Simulate an active claim by another process
      await mockCacheStorage.set(
        `app:auth:signup-token-claim:${userId}`,
        token,
        30
      );

      // Verify throws InvalidToken when attempting to claim
      await expect(tokenAppService.verifySignupToken(token)).rejects.toThrow(
        authError.InvalidToken
      );
    });

    it('should successfully release signup token claim', async () => {
      const token = await tokenAppService.generateSignupToken({ id: userId });

      // Set active claim
      await mockCacheStorage.set(
        `app:auth:signup-token-claim:${userId}`,
        token,
        30
      );

      // Release it
      await tokenAppService.releaseSignupTokenClaim(userId);

      // Verify that the claim key was deleted
      expect(mockCacheStorage.del).toHaveBeenCalledWith(
        `app:auth:signup-token-claim:${userId}`
      );
    });
  });

  describe('generatePasswordResetToken & verifyPasswordResetToken', () => {
    const userId = 'user-456' as TEntityId;

    it('should successfully generate and verify a reset token', async () => {
      const token = await tokenAppService.generatePasswordResetToken({
        id: userId,
      });
      expect(mockCacheStorage.set).toHaveBeenCalledWith(
        `app:auth:reset-token:${userId}`,
        token,
        2 * 60 * 60
      );
      expectTokenTtl(token, 2 * 60 * 60);

      const decoded = await tokenAppService.verifyPasswordResetToken(token);
      expect(decoded.id).toBe(userId);

      expect(mockCacheStorage.deleteIfValueMatches).toHaveBeenCalledWith(
        `app:auth:reset-token-claim:${userId}`,
        expect.any(String),
        [`app:auth:reset-token:${userId}`]
      );
    });

    it('should throw InvalidToken if token type is incorrect', async () => {
      const wrongToken = await tokenAppService.generateAccessToken({
        id: userId,
      });

      await expect(
        tokenAppService.verifyPasswordResetToken(wrongToken)
      ).rejects.toThrow(authError.InvalidToken);
    });

    it('should throw InvalidToken if token is missing from cache', async () => {
      const token = await tokenAppService.generatePasswordResetToken({
        id: userId,
      });

      await mockCacheStorage.del(`app:auth:reset-token:${userId}`);

      await expect(
        tokenAppService.verifyPasswordResetToken(token)
      ).rejects.toThrow(authError.InvalidToken);
    });

    it('allows exactly one concurrent claim and permits retry after release', async () => {
      const token = await tokenAppService.generatePasswordResetToken({
        id: userId,
      });

      const claims = await Promise.allSettled([
        tokenAppService.claimPasswordResetToken(token),
        tokenAppService.claimPasswordResetToken(token),
      ]);

      expect(
        claims.filter(({ status }) => status === 'fulfilled')
      ).toHaveLength(1);
      expect(claims.filter(({ status }) => status === 'rejected')).toHaveLength(
        1
      );

      const successfulClaim = claims.find(
        (claim) => claim.status === 'fulfilled'
      );
      if (!successfulClaim || successfulClaim.status !== 'fulfilled') {
        throw new Error('Expected a successful reset-token claim');
      }
      await tokenAppService.releasePasswordResetTokenClaim(
        successfulClaim.value
      );
      await expect(
        tokenAppService.claimPasswordResetToken(token)
      ).resolves.toMatchObject({ id: userId });
    });

    it('does not let a stale owner release or finalize another claim', async () => {
      const token = await tokenAppService.generatePasswordResetToken({
        id: userId,
      });
      const claim = await tokenAppService.claimPasswordResetToken(token);
      const staleClaim = { ...claim, owner: 'stale-owner' };

      await tokenAppService.releasePasswordResetTokenClaim(staleClaim);
      await expect(
        tokenAppService.claimPasswordResetToken(token)
      ).rejects.toThrow(authError.InvalidToken);

      await tokenAppService.finalizePasswordResetToken(staleClaim);
      await tokenAppService.releasePasswordResetTokenClaim(claim);
      await expect(
        tokenAppService.claimPasswordResetToken(token)
      ).resolves.toMatchObject({ id: userId });
    });

    it('claims a password reset token correctly when it does not contain an expiration claim', async () => {
      const token = jsonWebToken.sign({ id: userId, type: 'reset' }, secret, {
        algorithm: 'HS256',
        noTimestamp: true,
      });
      await mockCacheStorage.set(`app:auth:reset-token:${userId}`, token, 900);

      const claim = await tokenAppService.claimPasswordResetToken(token);
      expect(claim.id).toBe(userId);
      expect(claim.owner).toBeDefined();
    });
  });

  describe('generateAccessToken & getAuthUser', () => {
    const userId = 'user-789' as TEntityId;

    it('should successfully generate and decode an access token', async () => {
      const token = await tokenAppService.generateAccessToken({ id: userId });
      const decoded = await tokenAppService.getAuthUser(token);

      expect(decoded.id).toBe(userId);
      expect(jsonWebToken.decode(token, { complete: true })).toMatchObject({
        header: { alg: 'HS256' },
        payload: { id: userId, type: 'access' },
      });
      expectTokenTtl(token, 60 * 15);
    });

    it('issues unique access tokens for the same user in the same second', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00Z'));

      const first = await tokenAppService.generateAccessToken({ id: userId });
      const second = await tokenAppService.generateAccessToken({ id: userId });

      expect(first).not.toBe(second);
      expect(decodeToken(first)).toMatchObject({
        id: userId,
        type: 'access',
      });
      expect(decodeToken(second)).toMatchObject({
        id: userId,
        type: 'access',
      });
      expect(decodeToken(first).jti).not.toBe(decodeToken(second).jti);
    });

    it('should throw ExpiredToken for expired access tokens', async () => {
      const expiredToken = jsonWebToken.sign(
        { id: userId, type: 'access' },
        secret,
        { algorithm: 'HS256', expiresIn: -1 }
      );

      await expect(tokenAppService.getAuthUser(expiredToken)).rejects.toThrow(
        authError.ExpiredToken
      );
    });

    it('should throw InvalidToken if token type is not access', async () => {
      const wrongToken = await tokenAppService.generateRefreshToken({
        id: userId,
      });

      await expect(tokenAppService.getAuthUser(wrongToken)).rejects.toThrow(
        authError.InvalidToken
      );
    });

    it('should throw MalformedToken for complete garbage tokens', async () => {
      await expect(
        tokenAppService.getAuthUser('not.a.real.jwt')
      ).rejects.toThrow(authError.MalformedToken);
    });

    it('should throw InvalidToken for NotBeforeError', async () => {
      const notActiveToken = jsonWebToken.sign(
        { id: userId, type: 'access' },
        secret,
        { algorithm: 'HS256', notBefore: '1 hour' }
      );

      await expect(tokenAppService.getAuthUser(notActiveToken)).rejects.toThrow(
        authError.InvalidToken
      );
    });

    it('should throw InvalidToken for unknown error during verification', async () => {
      jest.spyOn(jsonWebToken, 'verify').mockImplementationOnce(() => {
        throw new Error('unexpected verification failure');
      });

      await expect(tokenAppService.getAuthUser('some-token')).rejects.toThrow(
        authError.InvalidToken
      );
    });
  });

  describe('generateRefreshToken & verifyRefreshToken', () => {
    const userId = 'user-999' as TEntityId;

    it('should successfully generate and verify a refresh token', async () => {
      const token = await tokenAppService.generateRefreshToken({ id: userId });
      const decoded = await tokenAppService.verifyRefreshToken(token);

      expect(decoded.id).toBe(userId);
      expectTokenTtl(token, 60 * 60 * 24 * 15);
    });

    it('issues unique refresh tokens for the same user in the same second', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00Z'));

      const first = await tokenAppService.generateRefreshToken({ id: userId });
      const second = await tokenAppService.generateRefreshToken({ id: userId });

      expect(first).not.toBe(second);
      expect(decodeToken(first)).toMatchObject({
        id: userId,
        type: 'refresh',
      });
      expect(decodeToken(second)).toMatchObject({
        id: userId,
        type: 'refresh',
      });
      expect(decodeToken(first).jti).not.toBe(decodeToken(second).jti);
    });

    it('should throw InvalidToken if token type is incorrect', async () => {
      const wrongToken = await tokenAppService.generateAccessToken({
        id: userId,
      });

      expect(() => tokenAppService.verifyRefreshToken(wrongToken)).toThrow(
        authError.InvalidToken
      );
    });
  });
});
