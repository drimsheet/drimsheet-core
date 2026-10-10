import { Server } from 'node:http';

import { Express } from 'express';
import request from 'supertest';

import appError from '@shared/values/errors/app.error';

import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag.service.mock';

import * as authUseCase from '@infra/ioc/usecases/auth';
import appContext from '@infra/runtime/app-context';
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

describe('POST /api/v1/auth/refresh-access-token', () => {
  afterEach(() => {
    expect(mockFeatureFlagAppService.canAccessAlpha1).not.toHaveBeenCalled();
  });

  let app: Express;
  let client: ReturnType<typeof request>;
  let refreshSpy: jest.SpiedFunction<
    typeof authUseCase.refreshAccessTokenUseCase
  >;
  let server: Server;

  beforeEach(() => {
    refreshSpy = jest
      .spyOn(authUseCase, 'refreshAccessTokenUseCase')
      .mockResolvedValue({ accessToken: 'new-refreshed-access-token' });
    app = createApplication();
    server = app.listen();
    client = request(server);
  });

  afterEach(async () => {
    refreshSpy.mockRestore();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  describe('200 Response', () => {
    it('returns only the access token and a secured replacement cookie', async () => {
      refreshSpy.mockImplementationOnce(async () => {
        appContext
          .get(['clientSession'])
          .clientSession.setRefreshToken('rotated-refresh-token');
        return { accessToken: 'new-refreshed-access-token' };
      });

      const response = await request(app)
        .post('/api/v1/auth/refresh-access-token')
        .set('Cookie', ['refresh_token=valid-refresh-token']);

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toContain('no-store');
      expect(response.headers['set-cookie'][0]).toContain(
        'refresh_token=rotated-refresh-token'
      );
      expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
      expect(response.headers['set-cookie'][0]).toContain('SameSite=Lax');
      expect(response.headers['set-cookie'][0]).toContain('Path=/api/v1/auth');
      expect(response.body).toEqual({
        accessToken: 'new-refreshed-access-token',
      });
      expect(refreshSpy).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(response.body)).not.toContain(
        'rotated-refresh-token'
      );
    });
  });

  describe('401 Response', () => {
    it('expires a rejected refresh cookie without echoing it', async () => {
      refreshSpy.mockImplementationOnce(async () => {
        appContext.get(['clientSession']).clientSession.clearRefreshToken();
        throw new appError.Unauthorized();
      });

      const response = await request(app)
        .post('/api/v1/auth/refresh-access-token')
        .set('Cookie', ['refresh_token=revoked-private-token']);

      expect(response.status).toBe(401);
      expect(response.headers['set-cookie'][0]).toContain('refresh_token=');
      expect(response.headers['set-cookie'][0]).toContain('Expires=');
      expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
      expect(response.headers['set-cookie'][0]).toContain('SameSite=Lax');
      expect(response.headers['set-cookie'][0]).toContain('Path=/api/v1/auth');
      expect(JSON.stringify(response.body)).not.toContain(
        'revoked-private-token'
      );
    });
  });

  describe('429 Response', () => {
    it('limits repeated attempts by refresh-token bucket', async () => {
      const attempts = [];

      for (let index = 0; index < 11; index += 1) {
        attempts.push(
          await client
            .post('/api/v1/auth/refresh-access-token')
            .set('Cookie', ['refresh_token=rate-limited-private-token'])
        );
      }

      const response = attempts[attempts.length - 1];

      expect(response.status).toBe(429);
      expect(response.headers['ratelimit-limit']).toBe('10');
      expect(refreshSpy).toHaveBeenCalledTimes(10);
      expect(JSON.stringify(response.body)).not.toContain(
        'rate-limited-private-token'
      );
    });
  });

  describe('500 Response', () => {
    it('sanitizes unexpected failures and keeps the cookie for retry', async () => {
      refreshSpy.mockRejectedValueOnce(
        new Error('database failed with private-refresh-token')
      );

      const response = await request(app)
        .post('/api/v1/auth/refresh-access-token')
        .set('Cookie', ['refresh_token=private-refresh-token']);

      expect(response.status).toBe(500);
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(JSON.stringify(response.body)).not.toContain(
        'private-refresh-token'
      );
      expect(JSON.stringify(response.body)).not.toContain('database failed');
    });
  });
});
