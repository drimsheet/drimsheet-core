import { Server } from 'node:http';

import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { IUser } from '@domain/user/types/user.types';

import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag-app.service.mock';

import { tokenAppService } from '@infra/ioc/services/auth';
import observability from '@infra/observability';
import accountingRepos from '@infra/persistence/repos/accounting';
import totalBalanceByTypeRepoQuery from '@infra/persistence/repos/ledger/queries/total-balance-by-type.reporting';
import userRepos from '@infra/persistence/repos/user';

import createApplication from '@interface/http/application';

import { closeTestServer, startTestServer } from '../../../setup/http-listener';

jest.mock(
  '@infra/persistence/repos/ledger/queries/total-balance-by-type.reporting',
  () => ({ __esModule: true, default: jest.fn() })
);
const mockTotalBalanceByTypeRepoQuery = jest.mocked(
  totalBalanceByTypeRepoQuery
);

jest.mock('@infra/ioc/services/user', () => ({
  ...jest.requireActual('@infra/ioc/services/user'),
  actorService: jest.requireActual(
    '@app/user/contracts/__mocks__/actor.services.mock'
  ).mockActorService,
}));
jest.mock('@infra/ioc/services/context', () => ({
  __esModule: true,
  featureFlagAppService: jest.requireActual(
    '@app/context/contracts/__mocks__/feature-flag-app.service.mock'
  ).default,
}));
jest.mock('@infra/ioc/services/auth', () => ({
  __esModule: true,
  tokenAppService: { getAuthUser: jest.fn() },
}));
jest.mock('@infra/persistence/repos/accounting', () => ({
  __esModule: true,
  default: {
    accountingEntity: jest.requireActual(
      '@app/accounting/contracts/__mocks__/accounting.repos.mock'
    ).mockAccountingEntityRepo,
  },
}));
jest.mock('@infra/persistence/repos/user', () => ({
  __esModule: true,
  default: {
    user: jest.requireActual('@app/user/contracts/__mocks__/user.repos.mock')
      .mockUserRepo,
  },
}));
// Exercise the real controller and use case with only read ports mocked.
jest.mock('@infra/ioc/usecases/ledger.reporting', () => ({
  getTotalBalanceByTypeUseCase: jest
    .requireActual(
      '@app/ledger/usecases/reporting/total-balance-by-type/total-balance-by-type.usecase'
    )
    .default({
      appContext: jest.requireActual('@infra/services/app-context.service')
        .default,
      repoQuery: jest.requireMock(
        '@infra/persistence/repos/ledger/queries/total-balance-by-type.reporting'
      ).default,
    }),
}));

const userId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const entityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
const endpoint = '/api/v1/reporting/ledger/total-balance-by-type';
const entity = {
  id: entityId,
  ownerId: userId,
  functionalCurrencyCode: 'NGN',
  jurisdictionCode: 'NG',
} as IAccountingEntity;
const account = {
  accountId: 'bank',
  functionalAmount: 150_000_000n,
};

describe('GET /reporting/ledger/total-balance-by-type', () => {
  let server: Server;
  beforeEach(async () => {
    jest.resetAllMocks();
    jest.mocked(tokenAppService.getAuthUser).mockResolvedValue({ id: userId });
    jest
      .mocked(userRepos.user.findById)
      .mockResolvedValue({ id: userId, actorId: userId } as IUser);
    jest
      .mocked(accountingRepos.accountingEntity.findByIdAndUserId)
      .mockResolvedValue(entity);
    mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(true);
    mockTotalBalanceByTypeRepoQuery.mockResolvedValue([]);
    server = await startTestServer(createApplication());
  });

  afterEach(async () => {
    await closeTestServer(server);
  });

  const getReport = (
    query: Record<string, string | string[] | undefined> = { type: 'asset' }
  ) =>
    request(server)
      .get(endpoint)
      .query(query)
      .set('Authorization', 'Bearer test-token')
      .set('x-accounting-entity-id', entityId);

  describe('200 Response', () => {
    it.each(['asset', 'liability', 'equity', 'revenue', 'expense'])(
      'returns the %s functional total',
      async (type) => {
        mockTotalBalanceByTypeRepoQuery.mockResolvedValue([
          account,
          {
            accountId: 'local-bank',
            functionalAmount: 100_000_000n,
          },
        ]);
        const response = await getReport({ type });
        expect(response.status).toBe(200);
        expect(response.type).toBe('application/json');
        expect(response.body).toEqual({
          totalFunctionalBalance: {
            amount: 250_000_000,
            currencyCode: 'NGN',
            isMinorUnit: true,
          },
        });
        expect(mockTotalBalanceByTypeRepoQuery).toHaveBeenCalledWith(
          {
            accountingEntityId: entityId,
            type: type,
            functionalCurrencyCode: 'NGN',
          },
          expect.any(Object)
        );
      }
    );

    it('returns zero when no accounts match', async () => {
      const response = await getReport();
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        totalFunctionalBalance: {
          amount: 0,
          currencyCode: 'NGN',
          isMinorUnit: true,
        },
      });
    });
  });

  describe('400 Response', () => {
    it('enforces the reporting amount ceiling', async () => {
      mockTotalBalanceByTypeRepoQuery.mockResolvedValue([
        { ...account, functionalAmount: 100_000_000_000_001n },
      ]);
      const response = await getReport();
      expect(response.status).toBe(400);
      expect(response.body.errorKey).toBe(
        'app_error_reporting_amount_limit_invalid'
      );
    });
  });

  describe('401 Response', () => {
    it('requires authentication before querying storage', async () => {
      const response = await request(server)
        .get(endpoint)
        .query({ type: 'asset' })
        .set('x-accounting-entity-id', entityId);
      expect(response.status).toBe(401);
      expect(mockTotalBalanceByTypeRepoQuery).not.toHaveBeenCalled();
    });
  });

  describe('403 Response', () => {
    it('requires feature access', async () => {
      mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(false);
      expect((await getReport()).status).toBe(403);
      expect(mockTotalBalanceByTypeRepoQuery).not.toHaveBeenCalled();
    });

    it('requires accounting entity ownership', async () => {
      jest
        .mocked(accountingRepos.accountingEntity.findByIdAndUserId)
        .mockResolvedValue({ ...entity, ownerId: entityId });
      expect((await getReport()).status).toBe(403);
      expect(mockTotalBalanceByTypeRepoQuery).not.toHaveBeenCalled();
    });
  });

  describe('500 Response', () => {
    it('reports missing stored balances', async () => {
      mockTotalBalanceByTypeRepoQuery.mockResolvedValue([
        { ...account, functionalAmount: null },
      ]);
      const response = await getReport();
      expect(response.status).toBe(500);
      expect(response.body.errorKey).toBe('app_error_unexpected');
    });
  });

  describe('422 Response', () => {
    it.each([
      {},
      { type: '' },
      { type: 'invalid' },
      { type: 'ASSET' },
      { type: ['asset', 'liability'] },
    ])('rejects missing or invalid type %j before storage', async (query) => {
      expect((await getReport(query)).status).toBe(422);
      expect(mockTotalBalanceByTypeRepoQuery).not.toHaveBeenCalled();
    });
  });

  describe('500 Response', () => {
    it('sanitizes storage failures', async () => {
      const reporter = jest
        .spyOn(observability.reporter, 'report')
        .mockImplementation(() => {});
      mockTotalBalanceByTypeRepoQuery.mockRejectedValue(
        new Error('private database failure')
      );
      try {
        const response = await getReport();
        expect(response.status).toBe(500);
        expect(response.body).toEqual({
          name: 'InternalServerError',
          errorKey: 'app_error_unexpected',
        });
        expect(reporter).toHaveBeenCalledTimes(1);
      } finally {
        reporter.mockRestore();
      }
    });
  });
});
