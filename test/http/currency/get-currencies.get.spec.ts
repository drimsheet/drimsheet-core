import { Server } from 'node:http';

import { Express } from 'express';
import request from 'supertest';

import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag-app.service.mock';
import { ICurrencyDto } from '@app/money/dtos/currency/currency.dto';

import * as moneyUseCases from '@infra/ioc/usecases/money';

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

jest.mock('../../../src/infra/ioc/usecases/money', () => ({
  __esModule: true,
  getAllCurrenciesUseCase: jest.fn(),
  getExchangeRateUseCase: jest.fn(),
  ingestExchangeRateUseCase: jest.fn(),
}));

const ENDPOINT = '/api/v1/currencies';
const currencies = [
  { code: 'USD', symbol: '$', name: 'US Dollar', minorUnit: 2 },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', minorUnit: 2 },
] satisfies ICurrencyDto[];

describe('GET /currencies', () => {
  let app: Express;
  let server: Server;
  const mockGetAllCurrencies =
    moneyUseCases.getAllCurrenciesUseCase as jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockGetAllCurrencies.mockResolvedValue(currencies);
    app = createApplication();
    server = await startTestServer(app);
  });

  afterEach(async () => {
    await closeTestServer(server);
  });

  afterEach(() => {
    expect(mockFeatureFlagAppService.canAccessAlpha1).not.toHaveBeenCalled();
  });

  describe('200 Response', () => {
    it('returns system currencies without Alpha 1 access evaluation', async () => {
      const response = await request(server).get(ENDPOINT);

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.body).toEqual(currencies);
      expect(mockGetAllCurrencies).toHaveBeenCalledTimes(1);
    });
  });
});
