import { Express } from 'express';
import request from 'supertest';

import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag.service.mock';
import { ICurrencyDto } from '@app/money/dtos/currency/currency.dto';

import * as moneyUseCases from '@infra/ioc/usecases/money';
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
  const mockGetAllCurrencies =
    moneyUseCases.getAllCurrenciesUseCase as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllCurrencies.mockResolvedValue(currencies);
    app = createApplication();
  });

  afterEach(() => {
    expect(mockFeatureFlagAppService.canAccessAlpha1).not.toHaveBeenCalled();
  });

  describe('200 Response', () => {
    it('returns system currencies without Alpha 1 access evaluation', async () => {
      const response = await request(app).get(ENDPOINT);

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.body).toEqual(currencies);
      expect(mockGetAllCurrencies).toHaveBeenCalledTimes(1);
    });
  });
});
