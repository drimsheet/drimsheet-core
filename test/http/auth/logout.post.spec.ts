import { Express } from 'express';
import request from 'supertest';

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

describe('POST /api/v1/auth/logout', () => {
  afterEach(() => {
    expect(mockFeatureFlagAppService.canAccessAlpha1).not.toHaveBeenCalled();
  });

  let app: Express;
  let logoutSpy: jest.SpiedFunction<typeof authUseCase.logoutUseCase>;

  beforeEach(() => {
    logoutSpy = jest.spyOn(authUseCase, 'logoutUseCase').mockResolvedValue();
    app = createApplication();
  });

  afterEach(() => {
    logoutSpy.mockRestore();
  });

  describe('200 Response', () => {
    it.each([
      ['a presented refresh cookie', 'refresh_token=valid-refresh-token'],
      ['no refresh cookie', undefined],
    ])('expires the cookie with no-store for %s', async (_, cookie) => {
      logoutSpy.mockImplementationOnce(async () => {
        appContext.get(['clientSession']).clientSession.clearRefreshToken();
      });

      const requestBuilder = request(app).post('/api/v1/auth/logout');
      if (cookie) {
        requestBuilder.set('Cookie', [cookie]);
      }

      const response = await requestBuilder;

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toContain('no-store');
      expect(response.headers['set-cookie'][0]).toMatch(/^refresh_token=;/);
      expect(response.headers['set-cookie'][0]).toContain('Expires=');
      expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
      expect(response.headers['set-cookie'][0]).toContain('SameSite=Lax');
      expect(response.headers['set-cookie'][0]).toContain('Path=/api/v1/auth');
      expect(response.body).toEqual({});
      expect(logoutSpy).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(response.body)).not.toContain(
        'valid-refresh-token'
      );
    });
  });

  describe('500 Response', () => {
    it('sanitizes unexpected failures and keeps the cookie for retry', async () => {
      logoutSpy.mockRejectedValueOnce(
        new Error('database failed with private-refresh-token')
      );

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', ['refresh_token=private-refresh-token']);

      expect(response.status).toBe(500);
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(response.body).toEqual({
        name: 'InternalServerError',
        errorKey: 'app_error_unexpected',
      });
      expect(JSON.stringify(response.body)).not.toContain(
        'private-refresh-token'
      );
      expect(JSON.stringify(response.body)).not.toContain('database failed');
    });
  });
});
