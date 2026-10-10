import { Server } from 'node:http';

import { Express } from 'express';
import request from 'supertest';

import appError from '@shared/values/errors/app.error';

import { IEmailLoginReq } from '@app/auth/dtos/auth/auth.dto';
import authError from '@app/auth/errors/auth.error';
import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag.service.mock';

import {
  makeAccountRateLimitKey,
  makeIpRateLimitKey,
} from '@infra/config/rate-limiter.config';
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

const ENDPOINT = '/api/v1/auth/login-with-email';

const validPayload: IEmailLoginReq = {
  email: 'ada@example.com',
  password: 'AnalyticalEngine1!',
};

const rateLimitEmails = [
  validPayload.email,
  'invalid-credentials@example.com',
  'validation-error@example.com',
  'repeated-attempts@example.com',
  'bucket@example.com',
  'unexpected-error@example.com',
];

describe('POST /auth/login-with-email', () => {
  afterEach(() => {
    expect(mockFeatureFlagAppService.canAccessAlpha1).not.toHaveBeenCalled();
  });

  let app: Express;
  let client: ReturnType<typeof request>;
  let loginWithEmailSpy: jest.SpiedFunction<
    typeof authUseCase.loginWithEmailUseCase
  >;
  let server: Server;

  beforeEach(async () => {
    const secret = process.env.JWT_SECRET_KEY || 'secret';
    await Promise.all([
      ...rateLimitEmails.map((email) =>
        middlewares.authRateLimiters.loginWithEmail.resetKey(
          makeAccountRateLimitKey('login-with-email', email, secret)!
        )
      ),
      middlewares.authRateLimiters.loginWithEmail.resetKey(
        makeIpRateLimitKey('::ffff:127.0.0.1')
      ),
    ]);
    loginWithEmailSpy = jest
      .spyOn(authUseCase, 'loginWithEmailUseCase')
      .mockResolvedValue({ accessToken: 'mock-access-token' });
    app = createApplication();
    server = app.listen();
    client = request(server);
  });

  afterEach(async () => {
    loginWithEmailSpy.mockRestore();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  describe('200 Response', () => {
    it('returns an uncached access token without leaking the password', async () => {
      const response = await request(app).post(ENDPOINT).send(validPayload);

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toContain('no-store');
      expect(response.body).toEqual({ accessToken: 'mock-access-token' });
      expect(JSON.stringify(response.body)).not.toContain(
        validPayload.password
      );
      expect(loginWithEmailSpy).toHaveBeenCalledWith(validPayload);
    });
  });

  describe('401 Response', () => {
    it('returns the invalid-credentials response for login failures', async () => {
      loginWithEmailSpy.mockRejectedValueOnce(
        new authError.InvalidCredentials()
      );

      const response = await request(app)
        .post(ENDPOINT)
        .send({
          ...validPayload,
          email: 'invalid-credentials@example.com',
        });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        name: 'AuthError',
        errorKey: 'auth_error_credentials_invalid_unauthorized',
      });
      expect(JSON.stringify(response.body)).not.toContain(
        validPayload.password
      );
    });
  });

  describe('422 Response', () => {
    it('rejects a missing password before invoking the use case', async () => {
      const response = await request(app)
        .post(ENDPOINT)
        .send({ email: validPayload.email });

      expect(response.status).toBe(422);
      expect(response.body.validationErrors).toEqual([
        {
          field: 'body.password',
          message: "'password' is required",
        },
      ]);
      expect(loginWithEmailSpy).not.toHaveBeenCalled();
    });

    it('returns a sanitized app-layer validation error', async () => {
      loginWithEmailSpy.mockRejectedValueOnce(
        new appError.UnprocessableEntity([
          { field: 'email', message: 'auth_error_email_invalid' },
        ])
      );

      const response = await request(app)
        .post(ENDPOINT)
        .send({ ...validPayload, email: 'validation-error@example.com' });

      expect(response.status).toBe(422);
      expect(JSON.stringify(response.body)).not.toContain(
        validPayload.password
      );
    });
  });

  describe('429 Response', () => {
    it('limits repeated attempts for one account', async () => {
      const rateLimitedPayload = {
        ...validPayload,
        email: 'repeated-attempts@example.com',
      };
      const responses = [];
      for (let index = 0; index < 6; index += 1) {
        responses.push(await client.post(ENDPOINT).send(rateLimitedPayload));
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
      expect(loginWithEmailSpy).toHaveBeenCalledTimes(5);
    });

    it('shares a rate-limit bucket across normalized email variants', async () => {
      const variants = [
        'bucket@example.com',
        'BUCKET@example.com',
        ' bucket@example.com',
        'bucket@example.com ',
        '  BUCKET@EXAMPLE.COM  ',
        'bucket@example.com',
      ];

      const responses = [];
      for (const email of variants) {
        responses.push(
          await client.post(ENDPOINT).send({ ...validPayload, email })
        );
      }

      expect(responses.slice(0, 5).map(({ status }) => status)).toEqual([
        200, 200, 200, 200, 200,
      ]);
      expect(responses[5].status).toBe(429);
      expect(loginWithEmailSpy).toHaveBeenCalledTimes(5);
    });

    it('falls back to the IP bucket for malformed email variants', async () => {
      const responses = [];
      for (let index = 0; index < 6; index += 1) {
        responses.push(
          await client
            .post(ENDPOINT)
            .send({ ...validPayload, email: `malformed-${index}` })
        );
      }

      expect(responses.slice(0, 5).map(({ status }) => status)).toEqual([
        200, 200, 200, 200, 200,
      ]);
      expect(responses[5].status).toBe(429);
      expect(loginWithEmailSpy).toHaveBeenCalledTimes(5);
    });
  });

  describe('500 Response', () => {
    it('sanitizes unexpected errors', async () => {
      loginWithEmailSpy.mockRejectedValueOnce(
        new Error(`failed with ${validPayload.password}`)
      );

      const response = await request(app)
        .post(ENDPOINT)
        .send({ ...validPayload, email: 'unexpected-error@example.com' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        name: 'InternalServerError',
        errorKey: 'app_error_unexpected',
      });
      expect(JSON.stringify(response.body)).not.toContain(
        validPayload.password
      );
    });
  });
});
