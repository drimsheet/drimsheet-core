import { Server } from 'node:http';

import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { IUser } from '@domain/user/types/user.types';

import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag-app.service.mock';

import { tokenAppService } from '@infra/ioc/services/auth';
import observability from '@infra/observability';
import accountingRepos from '@infra/persistence/repos/accounting';
import ledgerBalancesByCurrencyRepoQuery from '@infra/persistence/repos/ledger/queries/ledger-balances-by-currency.reporting';
import userRepos from '@infra/persistence/repos/user';

import createApplication from '@interface/http/application';

import { closeTestServer, startTestServer } from '../../../setup/http-listener';

jest.mock(
  '@infra/persistence/repos/ledger/queries/ledger-balances-by-currency.reporting',
  () => ({ __esModule: true, default: jest.fn() })
);
const mockLedgerBalancesByCurrencyRepoQuery = jest.mocked(
  ledgerBalancesByCurrencyRepoQuery
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
  getLedgerBalancesByCurrencyUseCase: jest
    .requireActual(
      '@app/ledger/usecases/reporting/ledger-balances-by-currency/ledger-balances-by-currency.usecase'
    )
    .default({
      appContext: jest.requireActual('@infra/services/app-context.service')
        .default,
      repoQuery: jest.requireMock(
        '@infra/persistence/repos/ledger/queries/ledger-balances-by-currency.reporting'
      ).default,
    }),
}));

const userId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const entityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
const endpoint = '/api/v1/reporting/ledger/ledger-balances-by-currency';
const entity = {
  id: entityId,
  ownerId: userId,
  functionalCurrencyCode: 'NGN',
  jurisdictionCode: 'NG',
} as IAccountingEntity;
const account = {
  accountId: 'bank',
  currencyCode: 'USD',
  amount: 100_000n,
  functionalAmount: 150_000_000n,
};

describe('GET /reporting/ledger/ledger-balances-by-currency', () => {
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
    mockLedgerBalancesByCurrencyRepoQuery.mockResolvedValue([]);
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
    it.each(['asset', 'liability'])(
      'returns the %s currency summary without type in the response',
      async (type) => {
        mockLedgerBalancesByCurrencyRepoQuery.mockResolvedValue([
          account,
          {
            accountId: 'local-bank',
            currencyCode: 'NGN',
            amount: 100_000_000n,
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
          balancesByCurrency: [
            {
              balance: {
                amount: 100_000_000,
                currencyCode: 'NGN',
                isMinorUnit: true,
              },
              functionalBalance: {
                amount: 100_000_000,
                currencyCode: 'NGN',
                isMinorUnit: true,
              },
            },
            {
              balance: {
                amount: 100_000,
                currencyCode: 'USD',
                isMinorUnit: true,
              },
              functionalBalance: {
                amount: 150_000_000,
                currencyCode: 'NGN',
                isMinorUnit: true,
              },
            },
          ],
        });
        expect(mockLedgerBalancesByCurrencyRepoQuery).toHaveBeenCalledWith(
          {
            accountingEntityId: entityId,
            type: type,
            functionalCurrencyCode: 'NGN',
          },
          expect.any(Object)
        );
      }
    );

    it('returns zero and no groups when no accounts match', async () => {
      const response = await getReport();
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        totalFunctionalBalance: {
          amount: 0,
          currencyCode: 'NGN',
          isMinorUnit: true,
        },
        balancesByCurrency: [],
      });
    });
  });

  describe('400 Response', () => {
    it('enforces the reporting amount ceiling', async () => {
      mockLedgerBalancesByCurrencyRepoQuery.mockResolvedValue([
        { ...account, amount: 100_000_000_000_001n },
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
      expect(mockLedgerBalancesByCurrencyRepoQuery).not.toHaveBeenCalled();
    });
  });

  describe('403 Response', () => {
    it('requires feature access', async () => {
      mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(false);
      expect((await getReport()).status).toBe(403);
      expect(mockLedgerBalancesByCurrencyRepoQuery).not.toHaveBeenCalled();
    });

    it('requires accounting entity ownership', async () => {
      jest
        .mocked(accountingRepos.accountingEntity.findByIdAndUserId)
        .mockResolvedValue({ ...entity, ownerId: entityId });
      expect((await getReport()).status).toBe(403);
      expect(mockLedgerBalancesByCurrencyRepoQuery).not.toHaveBeenCalled();
    });
  });

  describe('404 Response', () => {
    it('reports missing stored balances', async () => {
      mockLedgerBalancesByCurrencyRepoQuery.mockResolvedValue([
        { ...account, amount: null, functionalAmount: null },
      ]);
      const response = await getReport();
      expect(response.status).toBe(404);
      expect(response.body.errorKey).toBe('app_error_ledger_balance_not_found');
    });
  });

  describe('422 Response', () => {
    it.each([
      {},
      { type: '' },
      { type: 'equity' },
      { type: 'revenue' },
      { type: 'expense' },
      { type: 'ASSET' },
      { type: ['asset', 'liability'] },
    ])('rejects missing or invalid type %j before storage', async (query) => {
      expect((await getReport(query)).status).toBe(422);
      expect(mockLedgerBalancesByCurrencyRepoQuery).not.toHaveBeenCalled();
    });
  });

  describe('500 Response', () => {
    it('sanitizes storage failures', async () => {
      const reporter = jest
        .spyOn(observability.reporter, 'report')
        .mockImplementation(() => {});
      mockLedgerBalancesByCurrencyRepoQuery.mockRejectedValue(
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
