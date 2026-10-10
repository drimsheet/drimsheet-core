import { Server } from 'node:http';

import { Express } from 'express';
import request from 'supertest';

import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag.service.mock';

import { makeHashedRateLimitKey } from '@infra/config/rate-limiter.config';
import middlewares from '@infra/ioc/middlewares/http';
import * as authUseCase from '@infra/ioc/usecases/auth';
import { createApplication } from '@infra/server';

jest.mock('@infra/ioc/services/user', () => ({
  ...jest.requireActual('@infra/ioc/services/user'),
  actorService: jest.requireActual(
    '@app/user/contracts/__mocks__/actor.services.mock'
  ).mockActorService,
}));

jest.mock(
  '@infra/integrations/launchdarkly/launchdarkly-feature-flag.service',
  () => ({
    __esModule: true,
    default: jest.requireActual<
      typeof import('@app/context/contracts/__mocks__/feature-flag.service.mock')
    >('@app/context/contracts/__mocks__/feature-flag.service.mock').default,
  })
);

const ENDPOINT = '/api/v1/auth/signup/complete';
let tokenSequence = 0;

describe('POST /auth/signup/complete', () => {
  afterEach(() => {
    expect(mockFeatureFlagAppService.canAccessAlpha1).not.toHaveBeenCalled();
  });

  let app: Express;
  let client: ReturnType<typeof request>;
  let rateLimitToken: string;
  let server: Server;
  let verifyEmailSpy: jest.SpiedFunction<typeof authUseCase.verifyEmailUseCase>;

  beforeEach(async () => {
    tokenSequence += 1;
    rateLimitToken = `rate-limit-token-attempt-${tokenSequence}`;
    await middlewares.authRateLimiters.verifyEmail.resetKey(
      makeHashedRateLimitKey(
        'verify-email',
        rateLimitToken,
        process.env.JWT_SECRET_KEY || 'secret'
      )!
    );
    verifyEmailSpy = jest
      .spyOn(authUseCase, 'verifyEmailUseCase')
      .mockResolvedValue({ accessToken: 'mock-access-token' });
    app = createApplication();
    server = app.listen();
    client = request(server);
  });

  afterEach(async () => {
    verifyEmailSpy.mockRestore();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  describe('200 Response', () => {
    it('returns an access token with Cache-Control no-store for valid verification', async () => {
      const response = await request(app)
        .post(ENDPOINT)
        .send({ token: 'valid.jwt.token' });

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toContain('no-store');
      expect(response.body).toEqual({ accessToken: 'mock-access-token' });
      expect(JSON.stringify(response.body)).not.toContain('valid.jwt.token');
      expect(verifyEmailSpy).toHaveBeenCalledWith('valid.jwt.token');
    });
  });

  describe('401 Response', () => {
    it('sanitizes invalid or expired token errors', async () => {
      const authErrorModule = require('@app/auth/errors/auth.error').default;
      verifyEmailSpy.mockRejectedValueOnce(new authErrorModule.InvalidToken());

      const response = await request(app)
        .post(ENDPOINT)
        .send({ token: 'expired.or.invalid.token' });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        name: 'AuthError',
        errorKey: 'auth_error_token_invalid_unauthorized',
      });
      expect(JSON.stringify(response.body)).not.toContain(
        'expired.or.invalid.token'
      );
    });
  });

  describe('422 Response', () => {
    it('rejects an invalid request payload before invoking the use case', async () => {
      const response = await request(app).post(ENDPOINT).send({});

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        name: 'UnprocessableEntity',
        errorKey: 'app_error_validation_error',
        validationErrors: [
          {
            field: 'payload.token',
            message: "'token' is required",
          },
        ],
      });
      expect(verifyEmailSpy).not.toHaveBeenCalled();
    });

    it('rejects a non-string token payload', async () => {
      const response = await request(app).post(ENDPOINT).send({ token: 12345 });

      expect(response.status).toBe(422);
      expect(verifyEmailSpy).not.toHaveBeenCalled();
    });
  });

  describe('429 Response', () => {
    it('enforces rate limiting on repeated verification attempts', async () => {
      const responses = [];
      for (let index = 0; index < 6; index += 1) {
        responses.push(
          await client.post(ENDPOINT).send({ token: rateLimitToken })
        );
      }

      expect(responses.slice(0, 5).map(({ status }) => status)).toEqual([
        200, 200, 200, 200, 200,
      ]);
      expect(responses[5].status).toBe(429);
      expect(responses[5].body).toEqual({
        name: 'TooManyRequests',
        errorKey: 'app_error_too_many_requests',
        cause: {
          used: 6,
          limit: 5,
          message: 'auth_error_too_many_requests',
        },
      });
    });
  });

  describe('500 Response', () => {
    it('sanitizes unexpected internal errors without leaking the token', async () => {
      verifyEmailSpy.mockRejectedValueOnce(
        new Error(
          'Database connection failed with secret token: secret-value-123'
        )
      );

      const response = await request(app)
        .post(ENDPOINT)
        .send({ token: 'secret-value-123' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        name: 'InternalServerError',
        errorKey: 'app_error_unexpected',
      });
      expect(JSON.stringify(response.body)).not.toContain('secret-value-123');
    });
  });
});
