import { Express } from 'express';
import request from 'supertest';

import { IExchangeRate } from '@domain/money/types/exchange-rate.types';

import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag.service.mock';

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

const ENDPOINT = '/api/v1/currencies/exchange-rates';
const asOf = new Date('2026-08-20T00:00:00.000Z');
const createdAt = new Date('2026-08-20T01:00:00.000Z');
const exchangeRate = {
  currencyPair: 'USD/NGN',
  baseCurrencyCode: 'USD',
  targetCurrencyCode: 'NGN',
  rate: 1532.5,
  type: 'official',
  asOf,
  source: 'central-bank',
  createdAt,
} satisfies IExchangeRate;

describe('GET /currencies/exchange-rates', () => {
  let app: Express;
  const mockGetExchangeRates =
    moneyUseCases.getExchangeRateUseCase as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetExchangeRates.mockResolvedValue([exchangeRate]);
    app = createApplication();
  });

  afterEach(() => {
    expect(mockFeatureFlagAppService.canAccessAlpha1).not.toHaveBeenCalled();
  });

  describe('200 Response', () => {
    it('returns exchange rates and forwards coerced query values', async () => {
      const response = await request(app).get(
        `${ENDPOINT}?currencyPair=USD%2FNGN&type=official&asOf=${encodeURIComponent(
          asOf.toISOString()
        )}&page=2&limit=5`
      );

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.body).toEqual([
        {
          ...exchangeRate,
          asOf: asOf.toISOString(),
          createdAt: createdAt.toISOString(),
        },
      ]);
      expect(mockGetExchangeRates).toHaveBeenCalledWith({
        currencyPair: 'USD/NGN',
        type: 'official',
        asOf,
        page: 2,
        limit: 5,
      });
    });
  });

  describe('422 Response', () => {
    it('rejects a request without a currency pair before orchestration', async () => {
      const response = await request(app).get(ENDPOINT);

      expect(response.status).toBe(422);
      expect(mockGetExchangeRates).not.toHaveBeenCalled();
    });
  });
});
