import { Server } from 'node:http';

import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { IFiscalYear } from '@domain/accounting/types/fiscal-year.types';
import { IUser } from '@domain/user/types/user.types';

import { mockFiscalYearRepo } from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag-app.service.mock';

import { tokenAppService } from '@infra/ioc/services/auth';
import observability from '@infra/observability';
import accountingRepos from '@infra/persistence/repos/accounting';
import ledgerTotalDebitsAndCreditsByCurrencyRepoQuery from '@infra/persistence/repos/ledger/queries/ledger-total-debits-and-credits-by-currency.reporting';
import userRepos from '@infra/persistence/repos/user';

import createApplication from '@interface/http/application';

import { closeTestServer, startTestServer } from '../../../setup/http-listener';

jest.mock(
  '@infra/persistence/repos/ledger/queries/ledger-total-debits-and-credits-by-currency.reporting',
  () => ({ __esModule: true, default: jest.fn() })
);
const mockLedgerTotalDebitsAndCreditsByCurrencyRepoQuery = jest.mocked(
  ledgerTotalDebitsAndCreditsByCurrencyRepoQuery
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
  getLedgerTotalDebitsAndCreditsByCurrencyUseCase: jest
    .requireActual(
      '@app/ledger/usecases/reporting/ledger-total-debits-and-credits-by-currency/ledger-total-debits-and-credits-by-currency.usecase'
    )
    .default({
      appContext: jest.requireActual('@infra/services/app-context.service')
        .default,
      fiscalYearRepo: jest.requireActual(
        '@app/accounting/contracts/__mocks__/accounting.repos.mock'
      ).mockFiscalYearRepo,
      repoQuery: jest.requireMock(
        '@infra/persistence/repos/ledger/queries/ledger-total-debits-and-credits-by-currency.reporting'
      ).default,
    }),
}));

const userId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const entityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
const endpoint =
  '/api/v1/reporting/ledger/ledger-total-debits-and-credits-by-currency';
const entity = {
  id: entityId,
  ownerId: userId,
  functionalCurrencyCode: 'NGN',
  jurisdictionCode: 'NG',
} as IAccountingEntity;
const fiscalYear: IFiscalYear = {
  id: '123e4567-e89b-12d3-a456-426614174003' as TEntityId,
  createdBy: userId,
  accountingEntityId: entityId,
  name: '2025/26',
  startDate: new Date('2025-04-01'),
  endDate: new Date('2026-03-31'),
  status: 'closed',
  closedAt: new Date('2026-04-01'),
  updatedAt: new Date('2026-04-01'),
};
const validQuery = { fiscalYearId: fiscalYear.id, type: 'revenue' };

describe('GET /reporting/ledger/ledger-total-debits-and-credits-by-currency', () => {
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
    mockFiscalYearRepo.findById.mockResolvedValue(fiscalYear);
    mockLedgerTotalDebitsAndCreditsByCurrencyRepoQuery.mockResolvedValue([]);
    server = await startTestServer(createApplication());
  });
  afterEach(async () => {
    await closeTestServer(server);
  });
  const getReport = (query: Record<string, string | undefined> = validQuery) =>
    request(server)
      .get(endpoint)
      .query(query)
      .set('Authorization', 'Bearer test-token')
      .set('x-accounting-entity-id', entityId);

  describe('200 Response', () => {
    it.each(['asset', 'liability', 'revenue', 'expense'])(
      'returns original-currency debit/credit totals for %s',
      async (type) => {
        mockLedgerTotalDebitsAndCreditsByCurrencyRepoQuery.mockResolvedValue([
          { currencyCode: 'USD', debits: 100n, credits: 350n },
        ]);
        const response = await getReport({ ...validQuery, type });
        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          fiscalYearId: fiscalYear.id,
          period: { from: '2025-04-01', to: '2026-03-31' },
          totalsByCurrency: [
            {
              totalDebits: {
                amount: 100,
                currencyCode: 'USD',
                isMinorUnit: true,
              },
              totalCredits: {
                amount: 350,
                currencyCode: 'USD',
                isMinorUnit: true,
              },
            },
          ],
        });
        expect(mockFiscalYearRepo.findById).toHaveBeenCalledWith(
          entityId,
          fiscalYear.id,
          expect.any(Object)
        );
      }
    );
    it('accepts a single-day subperiod and returns no groups without activity', async () => {
      const response = await getReport({
        ...validQuery,
        startDate: '2025-07-01',
        endDate: '2025-07-01',
      });
      expect(response.status).toBe(200);
      expect(response.body.period).toEqual({
        from: '2025-07-01',
        to: '2025-07-01',
      });
      expect(response.body.totalsByCurrency).toEqual([]);
    });
  });
  describe('400 Response', () => {
    it.each([
      { startDate: '2025-03-31' },
      { endDate: '2026-04-01' },
      { startDate: '2025-08-01', endDate: '2025-07-01' },
    ])('rejects invalid date boundaries %j', async (dates) => {
      const response = await getReport({ ...validQuery, ...dates });
      expect(response.status).toBe(400);
      expect(response.body.errorKey).toBe('app_error_reporting_period_invalid');
      expect(
        mockLedgerTotalDebitsAndCreditsByCurrencyRepoQuery
      ).not.toHaveBeenCalled();
    });
  });
  describe('401 Response', () => {
    it('requires authentication', async () => {
      expect(
        (
          await request(server)
            .get(endpoint)
            .query(validQuery)
            .set('x-accounting-entity-id', entityId)
        ).status
      ).toBe(401);
      expect(mockFiscalYearRepo.findById).not.toHaveBeenCalled();
    });
  });
  describe('403 Response', () => {
    it('requires feature access', async () => {
      mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(false);
      expect((await getReport()).status).toBe(403);
      expect(mockFiscalYearRepo.findById).not.toHaveBeenCalled();
    });
    it('requires entity ownership', async () => {
      jest
        .mocked(accountingRepos.accountingEntity.findByIdAndUserId)
        .mockResolvedValue({ ...entity, ownerId: entityId });
      expect((await getReport()).status).toBe(403);
      expect(mockFiscalYearRepo.findById).not.toHaveBeenCalled();
    });
  });
  describe('404 Response', () => {
    it('rejects a missing or foreign fiscal year', async () => {
      mockFiscalYearRepo.findById.mockResolvedValue(null);
      expect((await getReport()).status).toBe(404);
      expect(
        mockLedgerTotalDebitsAndCreditsByCurrencyRepoQuery
      ).not.toHaveBeenCalled();
    });
  });
  describe('422 Response', () => {
    it.each([
      { fiscalYearId: undefined },
      { fiscalYearId: 'bad-id' },
      { type: undefined },
      { type: 'unknown' },
      { type: 'equity' },
      { startDate: '2025-02-30' },
      { endDate: '2025-01-01T12:00:00Z' },
    ])(
      'rejects malformed input %j before reading the fiscal year',
      async (invalid) => {
        expect((await getReport({ ...validQuery, ...invalid })).status).toBe(
          422
        );
        expect(mockFiscalYearRepo.findById).not.toHaveBeenCalled();
      }
    );
  });
  describe('500 Response', () => {
    it('sanitizes storage errors', async () => {
      const reporter = jest
        .spyOn(observability.reporter, 'report')
        .mockImplementation(() => {});
      mockLedgerTotalDebitsAndCreditsByCurrencyRepoQuery.mockRejectedValue(
        new Error('private storage failure')
      );
      try {
        const response = await getReport();
        expect(response.status).toBe(500);
        expect(response.body.errorKey).toBe('app_error_unexpected');
        expect(JSON.stringify(response.body)).not.toContain(
          'private storage failure'
        );
      } finally {
        reporter.mockRestore();
      }
    });
  });
});
