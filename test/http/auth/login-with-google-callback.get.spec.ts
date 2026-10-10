import { Express } from 'express';
import passport from 'passport';
import request from 'supertest';

import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag.service.mock';

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

jest.mock('../../../src/infra/ioc/usecases/auth', () => {
  const actual = jest.requireActual<typeof import('@infra/ioc/usecases/auth')>(
    '@infra/ioc/usecases/auth'
  );

  return {
    __esModule: true,
    ...actual,
    oAuthUseCase: {
      ...actual.oAuthUseCase,
      handleGoogleCallback: jest.fn(),
    },
  };
});

class CallbackGoogleStrategy extends passport.Strategy {
  name = 'google';
  static outcome: 'success' | 'failure' | 'error' = 'success';

  authenticate() {
    if (CallbackGoogleStrategy.outcome === 'error') {
      return this.error(new Error('provider token exchange failed'));
    }
    if (CallbackGoogleStrategy.outcome === 'failure') {
      return this.fail();
    }
    return this.success({ id: 'user-123', email: 'test@example.com' });
  }
}

describe('GET /api/v1/auth/google/callback', () => {
  afterEach(() => {
    expect(mockFeatureFlagAppService.canAccessAlpha1).not.toHaveBeenCalled();
  });

  let app: Express;
  const mockHandleGoogleCallback = authUseCase.oAuthUseCase
    .handleGoogleCallback as jest.Mock;

  beforeAll(() => {
    passport.use('google', new CallbackGoogleStrategy());
  });

  beforeEach(() => {
    jest.clearAllMocks();
    CallbackGoogleStrategy.outcome = 'success';
    mockHandleGoogleCallback.mockResolvedValue(
      'http://localhost:3000/auth/oauth-confirmation'
    );
    app = createApplication();
  });

  afterAll(() => {
    passport.unuse('google');
  });

  describe('401 Response', () => {
    it.each([
      ['missing cookie', '?state=expected', undefined],
      ['missing state', '', 'oauth_state=expected'],
      ['mismatched state', '?state=other', 'oauth_state=expected'],
      ['array state', '?state=expected&state=other', 'oauth_state=expected'],
    ])('rejects %s and clears state', async (_case, query, cookie) => {
      const pending = request(app).get(`/api/v1/auth/google/callback${query}`);
      if (cookie) pending.set('Cookie', [cookie]);
      const response = await pending;

      expect(response.status).toBe(401);
      expect(response.headers['cache-control']).toContain('no-store');
      expect(response.get('Set-Cookie')?.join(';')).toContain('oauth_state=;');
      expect(mockHandleGoogleCallback).not.toHaveBeenCalled();
    });

    it('reserves Unauthorized for a Passport no-user result', async () => {
      CallbackGoogleStrategy.outcome = 'failure';
      const response = await request(app)
        .get('/api/v1/auth/google/callback?state=matching')
        .set('Cookie', ['oauth_state=matching']);

      expect(response.status).toBe(401);
      expect(mockHandleGoogleCallback).not.toHaveBeenCalled();
    });
  });

  describe('302 Response', () => {
    it('redirects cleanly after passing the exact authenticated user', async () => {
      const response = await request(app)
        .get('/api/v1/auth/google/callback?state=matching&code=provider-code')
        .set('Cookie', ['oauth_state=matching']);

      expect(response.status).toBe(302);
      expect(mockHandleGoogleCallback).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-123' })
      );
      expect(response.headers.location).toBe(
        'http://localhost:3000/auth/oauth-confirmation'
      );
      expect(response.headers.location).not.toMatch(
        /provider-code|matching|access_token|refresh_token/
      );
      expect(response.headers['cache-control']).toContain('no-store');
      expect(response.get('Set-Cookie')?.join(';')).toContain('oauth_state=;');
    });
  });

  describe('500 Response', () => {
    it('sanitizes Passport operational errors and bypasses the use case', async () => {
      CallbackGoogleStrategy.outcome = 'error';
      const response = await request(app)
        .get('/api/v1/auth/google/callback?state=matching')
        .set('Cookie', ['oauth_state=matching']);

      expect(response.status).toBe(500);
      expect(JSON.stringify(response.body)).not.toContain(
        'provider token exchange failed'
      );
      expect(response.headers['cache-control']).toContain('no-store');
      expect(mockHandleGoogleCallback).not.toHaveBeenCalled();
    });

    it('sanitizes callback use-case failures', async () => {
      mockHandleGoogleCallback.mockRejectedValue(new Error('database details'));
      const response = await request(app)
        .get('/api/v1/auth/google/callback?state=matching')
        .set('Cookie', ['oauth_state=matching']);

      expect(response.status).toBe(500);
      expect(JSON.stringify(response.body)).not.toContain('database details');
      expect(response.headers['cache-control']).toContain('no-store');
    });
  });
});
