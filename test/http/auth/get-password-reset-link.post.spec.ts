import { Server } from 'node:http';

import { Express } from 'express';
import request from 'supertest';

import appError from '@shared/values/errors/app.error';

import { IRequestPasswordResetReq } from '@app/auth/dtos/auth/auth.dto';
import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag.service.mock';

import { makeIpRateLimitKey } from '@infra/config/rate-limiter.config';
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

const ENDPOINT = '/api/v1/auth/get-password-reset-link';

describe('POST /auth/get-password-reset-link', () => {
  afterEach(() => {
    expect(mockFeatureFlagAppService.canAccessAlpha1).not.toHaveBeenCalled();
  });

  let app: Express;
  let client: ReturnType<typeof request>;
  let getPasswordResetLinkSpy: jest.SpiedFunction<
    typeof authUseCase.getPasswordResetLinkUseCase
  >;
  let server: Server;

  beforeEach(async () => {
    getPasswordResetLinkSpy = jest
      .spyOn(authUseCase, 'getPasswordResetLinkUseCase')
      .mockResolvedValue(undefined);
    await middlewares.authRateLimiters.getPasswordResetLinkByIp.resetKey(
      makeIpRateLimitKey('::ffff:127.0.0.1')
    );
    app = createApplication();
    server = app.listen();
    client = request(server);
  });

  afterEach(async () => {
    getPasswordResetLinkSpy.mockRestore();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  describe('200 Response', () => {
    it('sends password reset link, returns 200 OK, and sets Cache-Control no-store header', async () => {
      const payload: IRequestPasswordResetReq = {
        email: 'success@example.com',
      };
      const response = await request(app).post(ENDPOINT).send(payload);

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toContain('no-store');
      expect(response.body).toEqual({});
      expect(getPasswordResetLinkSpy).toHaveBeenCalledWith(
        'success@example.com'
      );
    });
  });

  describe('422 Response', () => {
    it('rejects missing email field before invoking use case', async () => {
      const response = await request(app).post(ENDPOINT).send({});

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        name: 'UnprocessableEntity',
        errorKey: 'app_error_validation_error',
        validationErrors: [
          {
            field: 'payload.email',
            message: "'email' is required",
          },
        ],
      });
      expect(getPasswordResetLinkSpy).not.toHaveBeenCalled();
    });

    it('sanitizes application validation failures', async () => {
      getPasswordResetLinkSpy.mockRejectedValueOnce(
        new appError.UnprocessableEntity([
          { field: 'email', message: 'auth_error_email_invalid' },
        ])
      );

      const response = await request(app)
        .post(ENDPOINT)
        .send({ email: 'validation-error@example.com' });

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        name: 'UnprocessableEntity',
        errorKey: 'app_error_validation_error',
        validationErrors: [
          {
            field: 'email',
            message: 'auth_error_email_invalid',
          },
        ],
      });
      expect(getPasswordResetLinkSpy).toHaveBeenCalledWith(
        'validation-error@example.com'
      );
    });
  });

  describe('429 Response', () => {
    it('limits repeated attempts for the same email', async () => {
      const payload = { email: 'rate-limit-account@example.com' };
      const responses = [];
      for (let index = 0; index < 6; index += 1) {
        responses.push(await client.post(ENDPOINT).send(payload));
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
      expect(getPasswordResetLinkSpy).toHaveBeenCalledTimes(5);
    });

    it('limits rotating email requests by IP', async () => {
      const responses = [];
      for (let index = 0; index < 21; index += 1) {
        responses.push(
          await client
            .post(ENDPOINT)
            .send({ email: `rotating-email-${index}@example.com` })
        );
      }

      expect(responses.slice(0, 20).every(({ status }) => status === 200)).toBe(
        true
      );
      expect(responses[20].status).toBe(429);
      expect(getPasswordResetLinkSpy).toHaveBeenCalledTimes(20);
    });
  });

  describe('500 Response', () => {
    it('sanitizes unexpected errors without leaking the email', async () => {
      const payload = { email: 'unexpected-error@example.com' };
      getPasswordResetLinkSpy.mockRejectedValueOnce(
        new Error(`Database lookup failed for email ${payload.email}`)
      );

      const response = await request(app).post(ENDPOINT).send(payload);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        name: 'InternalServerError',
        errorKey: 'app_error_unexpected',
      });
      expect(JSON.stringify(response.body)).not.toContain(
        'unexpected-error@example.com'
      );
      expect(JSON.stringify(response.body)).not.toContain(
        'Database lookup failed'
      );
    });
  });
});
