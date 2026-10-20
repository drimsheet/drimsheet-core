import { Server } from 'node:http';

import { Express } from 'express';
import request from 'supertest';

import { SYSTEM_JURISDICTIONS } from '@domain/accounting/config/jurisdictions.config';

import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag-app.service.mock';

import * as accountingUsecases from '@infra/ioc/usecases/accounting';

import createApplication from '@interface/http/application';

import { closeTestServer, startTestServer } from '../../setup/http-listener';

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

jest.mock('../../../src/infra/ioc/usecases/accounting', () => ({
  __esModule: true,
  createAccountingEntityUseCase: jest.fn(),
  getJurisdictionsUseCase: jest.fn(),
  getUserAccountingEntitiesUseCase: jest.fn(),
  getActiveAccountingEntityUseCase: jest.fn(),
}));

const ENDPOINT = '/api/v1/accounting/jurisdictions';
const jurisdictions = Object.values(SYSTEM_JURISDICTIONS).map(
  (jurisdiction) => ({
    code: jurisdiction.code,
    name: jurisdiction.name,
    currencyCode: jurisdiction.currency.code,
    maxFiscalMonths: jurisdiction.maxFiscalMonths,
    accountingStandards: jurisdiction.accountingStandards,
  })
);

describe('GET /accounting/jurisdictions', () => {
  afterEach(() => {
    expect(mockFeatureFlagAppService.canAccessAlpha1).not.toHaveBeenCalled();
  });

  let app: Express;
  let server: Server;
  const mockGetJurisdictions =
    accountingUsecases.getJurisdictionsUseCase as jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockGetJurisdictions.mockResolvedValue(jurisdictions);
    app = createApplication();
    server = await startTestServer(app);
  });

  afterEach(async () => {
    await closeTestServer(server);
  });

  describe('200 Response', () => {
    it('returns the public jurisdiction contract with security headers', async () => {
      const response = await request(server).get(ENDPOINT);

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(response.headers['x-correlation-id']).toEqual(expect.any(String));
      expect(response.body).toEqual(jurisdictions);
      expect(mockGetJurisdictions).toHaveBeenCalledTimes(1);
    });
  });

  describe('500 Response', () => {
    it('sanitizes unexpected failures', async () => {
      mockGetJurisdictions.mockRejectedValue(
        new Error('internal configuration secret')
      );

      const response = await request(server).get(ENDPOINT);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        name: 'InternalServerError',
        errorKey: 'app_error_unexpected',
      });
      expect(JSON.stringify(response.body)).not.toContain('configuration');
    });
  });
});
