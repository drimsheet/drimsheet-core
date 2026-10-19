import { Express, NextFunction, Request, Response } from 'express';
import request from 'supertest';

import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag-app.service.mock';

import createApplication from '@interface/http/application';

jest.mock('@infra/ioc/services/user', () => ({
  ...jest.requireActual('@infra/ioc/services/user'),
  actorService: jest.requireActual(
    '@app/user/contracts/__mocks__/actor.services.mock'
  ).mockActorService,
}));

jest.mock('@infra/ioc/services/context', () => ({
  __esModule: true,
  featureFlagAppService: jest.requireActual<
    typeof import('@app/context/contracts/__mocks__/feature-flag-app.service.mock')
  >('@app/context/contracts/__mocks__/feature-flag-app.service.mock').default,
}));

jest.mock('@infra/ioc/middlewares/http', () => {
  const actual = jest.requireActual<
    typeof import('@infra/ioc/middlewares/http')
  >('@infra/ioc/middlewares/http');
  const passThrough = (_req: Request, _res: Response, next: NextFunction) =>
    next();

  return {
    __esModule: true,
    default: {
      ...actual.default,
      initiateLoginWithGoogle: passThrough,
      completeLoginWithGoogle: passThrough,
    },
  };
});

describe('GET /auth/google controller fallthrough', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApplication();
  });

  afterEach(() => {
    expect(mockFeatureFlagAppService.canAccessAlpha1).not.toHaveBeenCalled();
  });

  it.each(['/api/v1/auth/google', '/api/v1/auth/google/callback'])(
    'executes the TSOA controller contract for %s when middleware continues',
    async (endpoint) => {
      const response = await request(app).get(endpoint);

      expect(response.status).toBe(302);
      expect(response.body).toEqual({});
    }
  );
});
