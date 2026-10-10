import { Server } from 'node:http';

import { Express } from 'express';
import request from 'supertest';

import appError from '@shared/values/errors/app.error';

import { IResetPasswordReq } from '@app/auth/dtos/auth/auth.dto';
import authError from '@app/auth/errors/auth.error';
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

const ENDPOINT = '/api/v1/auth/reset-password';
let payloadSequence = 0;

describe('POST /auth/reset-password', () => {
  afterEach(() => {
    expect(mockFeatureFlagAppService.canAccessAlpha1).not.toHaveBeenCalled();
  });

  let app: Express;
  let client: ReturnType<typeof request>;
  let validPayload: IResetPasswordReq;
  let resetPasswordSpy: jest.SpiedFunction<
    typeof authUseCase.resetPasswordUseCase
  >;
  let server: Server;

  beforeEach(async () => {
    payloadSequence += 1;
    validPayload = {
      token: `opaque-reset-credential-${payloadSequence}`,
      password: 'AnalyticalEngine1!',
      confirmPassword: 'AnalyticalEngine1!',
    };
    await middlewares.authRateLimiters.resetPasswordByIp.resetKey(
      makeIpRateLimitKey('::ffff:127.0.0.1')
    );
    resetPasswordSpy = jest
      .spyOn(authUseCase, 'resetPasswordUseCase')
      .mockResolvedValue({ accessToken: 'mock-access-token' });
    app = createApplication();
    server = app.listen();
    client = request(server);
  });

  afterEach(async () => {
    resetPasswordSpy.mockRestore();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  describe('200 Response', () => {
    it('returns only an uncached access token and forwards the payload', async () => {
      const response = await request(app).post(ENDPOINT).send(validPayload);

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toContain('no-store');
      expect(response.body).toEqual({ accessToken: 'mock-access-token' });
      expect(resetPasswordSpy).toHaveBeenCalledWith(validPayload);
      const body = JSON.stringify(response.body);
      expect(body).not.toContain(validPayload.token);
      expect(body).not.toContain(validPayload.password);
    });
  });

  describe('401 Response', () => {
    it.each([
      new authError.InvalidToken(),
      new authError.MalformedToken(),
      new authError.ExpiredToken(),
    ])('sanitizes reset-token failures', async (error) => {
      resetPasswordSpy.mockRejectedValueOnce(error);

      const response = await request(app).post(ENDPOINT).send(validPayload);

      expect(response.status).toBe(401);
      expect(JSON.stringify(response.body)).not.toContain(validPayload.token);
      expect(JSON.stringify(response.body)).not.toContain(
        validPayload.password
      );
    });
  });

  describe('422 Response', () => {
    it('rejects missing fields before invoking the use case', async () => {
      const response = await request(app)
        .post(ENDPOINT)
        .send({ token: validPayload.token });

      expect(response.status).toBe(422);
      expect(resetPasswordSpy).not.toHaveBeenCalled();
    });

    it('sanitizes application password validation failures', async () => {
      resetPasswordSpy.mockRejectedValueOnce(
        new appError.UnprocessableEntity([
          { field: 'password', message: 'auth_error_password_invalid' },
        ])
      );

      const response = await request(app).post(ENDPOINT).send(validPayload);

      expect(response.status).toBe(422);
      expect(JSON.stringify(response.body)).not.toContain(validPayload.token);
      expect(JSON.stringify(response.body)).not.toContain(
        validPayload.password
      );
    });
  });

  describe('429 Response', () => {
    it('limits repeated attempts for the same token before orchestration', async () => {
      const responses = [];
      for (let index = 0; index < 6; index += 1) {
        responses.push(await client.post(ENDPOINT).send(validPayload));
      }

      expect(responses.slice(0, 5).map(({ status }) => status)).toEqual([
        200, 200, 200, 200, 200,
      ]);
      expect(responses[5].status).toBe(429);
      expect(resetPasswordSpy).toHaveBeenCalledTimes(5);
    });

    it('limits rotating token values by IP before orchestration', async () => {
      const responses = [];
      for (let index = 0; index < 21; index += 1) {
        responses.push(
          await client.post(ENDPOINT).send({
            ...validPayload,
            token: `rotating-credential-${payloadSequence}-${index}`,
          })
        );
      }

      expect(responses.slice(0, 20).every(({ status }) => status === 200)).toBe(
        true
      );
      expect(responses[20].status).toBe(429);
      expect(resetPasswordSpy).toHaveBeenCalledTimes(20);
    });
  });

  describe('500 Response', () => {
    it('sanitizes unexpected dependency failures', async () => {
      resetPasswordSpy.mockRejectedValueOnce(
        new Error(
          `${validPayload.token}:${validPayload.password}:${validPayload.confirmPassword}`
        )
      );

      const response = await request(app).post(ENDPOINT).send(validPayload);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        name: 'InternalServerError',
        errorKey: 'app_error_unexpected',
      });
      const body = JSON.stringify(response.body);
      expect(body).not.toContain(validPayload.token);
      expect(body).not.toContain(validPayload.password);
      expect(body).not.toContain('opaque-reset-credential');
      expect(body).not.toContain('AnalyticalEngine');
    });
  });
});
