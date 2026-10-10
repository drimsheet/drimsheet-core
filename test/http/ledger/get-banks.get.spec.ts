import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IUser } from '@domain/user/types/user.types';

import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag.service.mock';
import { IBankDirectoryDto } from '@app/ledger/dtos/bank-directory/bank-directory.dto';

import { tokenAppService } from '@infra/ioc/services/auth';
import * as ledgerUseCases from '@infra/ioc/usecases/ledger';
import userRepos from '@infra/persistence/repos/user';
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

jest.mock('../../../src/infra/ioc/services/auth', () => ({
  __esModule: true,
  tokenAppService: {
    getAuthUser: jest.fn(),
  },
}));

jest.mock('../../../src/infra/persistence/repos/user', () => ({
  __esModule: true,
  default: {
    user: {
      findById: jest.fn(),
    },
  },
}));

jest.mock('../../../src/infra/ioc/usecases/ledger', () => ({
  __esModule: true,
  getBanksUseCase: jest.fn(),
  getLedgerAccountsUseCase: jest.fn(),
  getLedgerAccountUseCase: jest.fn(),
  adjustLedgerAccountBalanceUseCase: jest.fn(),
  getAccountTransactionsUseCase: jest.fn(),
  createPettyCashAccountUseCase: jest.fn(),
}));

const ENDPOINT = '/api/v1/banks';
const userId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;

const mockUser: IUser = {
  createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
  actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
  id: userId,
  version: 1,
  email: 'user@example.com',
  emailVerified: true,
  firstName: 'First',
  lastName: 'Last',
  deletedAt: null,
  createdAt: new Date('2026-03-13T00:00:00.000Z'),
  updatedAt: new Date('2026-03-13T00:00:00.000Z'),
};

const dummyBanks: IBankDirectoryDto[] = [
  { countryCode: 'NG', bankCode: '044', bankName: 'Access Bank' },
  { countryCode: 'NG', bankCode: '058', bankName: 'Guaranty Trust Bank' },
];

describe('GET /banks', () => {
  afterEach(() => {
    expect(mockFeatureFlagAppService.canAccessAlpha1).not.toHaveBeenCalled();
  });

  let app: Express;
  const mockGetAuthUser = tokenAppService.getAuthUser as jest.Mock;
  const mockFindUser = userRepos.user.findById as jest.Mock;
  const mockGetBanks = ledgerUseCases.getBanksUseCase as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthUser.mockResolvedValue({ id: userId });
    mockFindUser.mockResolvedValue(mockUser);
    mockGetBanks.mockResolvedValue(dummyBanks);
    app = createApplication();
  });

  describe('200 Response', () => {
    it('returns bank directory entries for an authorized request with valid countryCode', async () => {
      const response = await request(app)
        .get(`${ENDPOINT}?countryCode=NG`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(response.body).toEqual(dummyBanks);
      expect(mockGetBanks).toHaveBeenCalledWith({ countryCode: 'NG' });
    });

    it('returns empty array when valid country has no dummy banks', async () => {
      mockGetBanks.mockResolvedValue([]);

      const response = await request(app)
        .get(`${ENDPOINT}?countryCode=US`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
      expect(mockGetBanks).toHaveBeenCalledWith({ countryCode: 'US' });
    });
  });

  describe('401 Response', () => {
    it('rejects unauthenticated request', async () => {
      const response = await request(app).get(`${ENDPOINT}?countryCode=NG`);

      expect(response.status).toBe(401);
      expect(mockGetBanks).not.toHaveBeenCalled();
    });
  });

  describe('422 Response', () => {
    it('rejects request with invalid country code', async () => {
      mockGetBanks.mockRejectedValueOnce(
        new appError.UnprocessableEntity([
          {
            field: 'countryCode',
            message: 'accounting_error_jurisdiction_code_invalid',
          },
        ])
      );

      const response = await request(app)
        .get(`${ENDPOINT}?countryCode=XX`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(422);
      expect(response.body).toMatchObject({
        name: 'UnprocessableEntity',
        errorKey: 'app_error_validation_error',
      });
      expect(mockGetBanks).toHaveBeenCalledWith({ countryCode: 'XX' });
    });

    it('rejects request with missing countryCode parameter before orchestration', async () => {
      const response = await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(422);
      expect(mockGetBanks).not.toHaveBeenCalled();
    });
  });
});
