import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';

import mockAppContext, {
  mockClientSession,
} from '@app/context/contracts/__mocks__/app-context.mock';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import reportingError from '@app/ledger/errors/reporting.error';

import { IGetRevenueExpenseAccountsQuery } from './dto';
import type { TGetRevenueExpenseAccountsRepoQuery } from './revenue-expense-accounts.usecase';
import makeGetRevenueExpenseAccountsUsecase, {
  IGetRevenueExpenseAccountsRepoQueryOutput,
} from './revenue-expense-accounts.usecase';

const mockRevenueExpenseAccountsRepoQuery: jest.MockedFunction<TGetRevenueExpenseAccountsRepoQuery> =
  jest.fn();

describe('get-revenue-expense-accounts.usecase.spec', () => {
  const entityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
  const account: IGetRevenueExpenseAccountsRepoQueryOutput = {
    accountId: 'sales',
    accountName: 'Product sales',
    code: '400001',
    type: 'revenue',
    subType: 'sales',
    status: 'active',
    isControlAccount: false,
    controlAccountId: 'sales-header',
    functionalBalance: 8_400_000_00n,
    transactionCount: 128n,
  };

  const header: IGetRevenueExpenseAccountsRepoQueryOutput = {
    ...account,
    accountId: 'sales-header',
    code: '400000',
    isControlAccount: true,
    controlAccountId: null,
    transactionCount: 0n,
  };

  describe('getRevenueExpenseAccountsUsecase', () => {
    const usecase = makeGetRevenueExpenseAccountsUsecase({
      appContext: mockAppContext,
      repoQuery: mockRevenueExpenseAccountsRepoQuery,
    });

    beforeEach(() => {
      jest.resetAllMocks();
      mockAppContext.get.mockReturnValue({
        accountingEntity: {
          id: entityId,
          functionalCurrencyCode: 'NGN',
        } as IAccountingEntity,
        correlationId: 'accounts-spec',
        idempotencyKey: '',
        clientSession: mockClientSession,
      });
      mockRevenueExpenseAccountsRepoQuery.mockResolvedValue([]);
    });

    it('reads headers and posting accounts once in the active entity and functional currency', async () => {
      expect(await usecase({})).toEqual({
        data: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
      });
      expect(mockAppContext.get).toHaveBeenCalledWith(['accountingEntity']);
      expect(mockRevenueExpenseAccountsRepoQuery).toHaveBeenCalledTimes(1);
      expect(mockRevenueExpenseAccountsRepoQuery).toHaveBeenCalledWith(
        { accountingEntityId: entityId, currencyCode: 'NGN' },
        { correlationId: 'accounts-spec' }
      );
    });

    it('returns posting accounts with header-based shares and their own journal-line counts', async () => {
      mockRevenueExpenseAccountsRepoQuery.mockResolvedValue([
        { ...header, functionalBalance: 12_400_000_00n },
        {
          ...header,
          accountId: 'expense-header',
          code: '500000',
          type: 'expense',
          functionalBalance: 3_600_000_00n,
        },
        account,
        {
          ...account,
          accountId: 'services',
          accountName: 'Services',
          functionalBalance: 3_100_000_00n,
        },
        { ...account, accountId: 'other', functionalBalance: 900_000_00n },
        {
          ...account,
          accountId: 'rent',
          type: 'expense',
          functionalBalance: 1_200_000_00n,
        },
        {
          ...account,
          accountId: 'salary',
          type: 'expense',
          functionalBalance: 2_400_000_00n,
        },
      ]);
      const response = await usecase({});
      expect(response.data[0]).toEqual({
        accountId: 'sales',
        accountName: 'Product sales',
        code: '400001',
        type: 'revenue',
        subType: 'sales',
        status: 'active',
        amount: {
          amount: 8_400_000_00,
          currencyCode: 'NGN',
          isMinorUnit: true,
        },
        sharePercentage: 67.74,
        transactionCount: 128,
      });
      expect(response.data.map((row) => row.sharePercentage)).toEqual([
        67.74, 25, 7.26, 33.33, 66.67,
      ]);
    });

    it('retains zero balances, all account statuses and actual suspense account identities', async () => {
      mockRevenueExpenseAccountsRepoQuery.mockResolvedValue([
        {
          ...account,
          status: 'draft',
          functionalBalance: 0n,
          transactionCount: 0n,
        },
        {
          ...account,
          accountId: 'expense',
          type: 'expense',
          status: 'archived',
          functionalBalance: 0n,
        },
        {
          ...account,
          accountId: 'asset-suspense',
          controlAccountId: null,
          type: 'asset',
          subType: 'suspense',
          functionalBalance: 900n,
        },
        {
          ...account,
          accountId: 'liability-suspense',
          controlAccountId: null,
          type: 'liability',
          subType: 'suspense',
          functionalBalance: 200n,
        },
      ]);
      const response = await usecase({});
      expect(response.data.map((row) => row.accountId)).toEqual([
        'sales',
        'expense',
        'asset-suspense',
        'liability-suspense',
      ]);
      expect(response.data.map((row) => row.sharePercentage)).toEqual([
        null,
        null,
        null,
        null,
      ]);
      expect(response.data.map((row) => row.amount.amount)).toEqual([
        0, 0, 900, 200,
      ]);
      expect(response.data.map((row) => row.status)).toEqual([
        'draft',
        'archived',
        'active',
        'active',
      ]);
    });

    it('keeps the full type denominator when searching, filtering and paging', async () => {
      mockRevenueExpenseAccountsRepoQuery.mockResolvedValue([
        { ...header, functionalBalance: 100n },
        {
          ...header,
          accountId: 'expense-header',
          code: '500000',
          type: 'expense',
          functionalBalance: 600n,
        },
        { ...account, functionalBalance: 60n },
        {
          ...account,
          accountId: 'services',
          accountName: 'Services',
          code: '401000',
          functionalBalance: 40n,
        },
        {
          ...account,
          accountId: 'rent',
          type: 'expense',
          functionalBalance: 600n,
        },
        {
          ...account,
          accountId: 'suspense',
          type: 'liability',
          subType: 'suspense',
          functionalBalance: 1000n,
        },
      ]);
      const searched = await usecase({ search: 'SERV', type: 'revenue' });
      expect(searched.data).toHaveLength(1);
      expect(searched.data[0].sharePercentage).toBe(40);
      expect(searched.meta.total).toBe(1);
      const paged = await usecase({ type: 'revenue', page: 2, limit: 1 });
      expect(paged.data[0].accountId).toBe('services');
      expect(paged.data[0].sharePercentage).toBe(40);
      expect(paged.meta).toEqual({
        page: 2,
        limit: 1,
        total: 2,
        totalPages: 2,
      });
      const byCode = await usecase({ search: '4010' });
      expect(byCode.data[0].accountId).toBe('services');
      expect((await usecase({ search: 'missing' })).data).toEqual([]);
      expect(
        (await usecase({ type: 'expense' })).data.map((row) => row.accountId)
      ).toEqual(['rent']);
      expect((await usecase({ page: 4, limit: 2 })).data).toEqual([]);
    });

    it('preserves signed balances without reinterpreting the ledger balance effect', async () => {
      mockRevenueExpenseAccountsRepoQuery.mockResolvedValue([
        { ...account, functionalBalance: -50n },
        { ...account, accountId: 'other', functionalBalance: 50n },
      ]);
      const response = await usecase({});
      expect(response.data.map((row) => row.amount.amount)).toEqual([-50, 50]);
      expect(response.data.map((row) => row.sharePercentage)).toEqual([
        null,
        null,
      ]);
    });

    it.each([
      { page: 0 },
      { page: 1.5 },
      { limit: 0 },
      { limit: 201 },
      { limit: 1.5 },
      { search: 123 },
      { type: 'asset' },
    ])('rejects invalid query %j before querying storage', async (query) => {
      await expect(
        usecase(query as IGetRevenueExpenseAccountsQuery)
      ).rejects.toThrow(appError.UnprocessableEntity);
      expect(mockRevenueExpenseAccountsRepoQuery).not.toHaveBeenCalled();
    });

    it.each([-1n, 9007199254740993n])(
      'rejects invalid counts %s',
      async (transactionCount) => {
        mockRevenueExpenseAccountsRepoQuery.mockResolvedValue([
          { ...account, transactionCount },
        ]);
        await expect(usecase({})).rejects.toThrow(
          reportingError.AmountOutOfRange
        );
      }
    );

    it('rejects missing balances instead of presenting invented zeros', async () => {
      mockRevenueExpenseAccountsRepoQuery.mockResolvedValue([
        { ...account, functionalBalance: null },
      ]);
      await expect(usecase({})).rejects.toThrow(ledgerAppError.BalanceNotFound);
    });

    it.each([100_000_000_000_001n, -100_000_000_000_001n])(
      'enforces the existing amount limit on rows %s',
      async (functionalBalance) => {
        mockRevenueExpenseAccountsRepoQuery.mockResolvedValue([
          { ...account, functionalBalance },
        ]);
        await expect(usecase({})).rejects.toThrow(
          reportingError.ReportAmountLimitExceeded
        );
      }
    );

    it('enforces the amount limit on the full type total before search', async () => {
      mockRevenueExpenseAccountsRepoQuery.mockResolvedValue([
        { ...header, functionalBalance: 60_000_000_000_000n },
        {
          ...account,
          isControlAccount: true,
          controlAccountId: null,
          accountId: 'other-header',
          functionalBalance: 60_000_000_000_000n,
        },
      ]);
      await expect(usecase({ search: 'missing' })).rejects.toThrow(
        reportingError.ReportAmountLimitExceeded
      );
    });

    it('uses only root header totals even when posting balances differ and nested controls exist', async () => {
      mockRevenueExpenseAccountsRepoQuery.mockResolvedValue([
        { ...header, functionalBalance: 150n },
        {
          ...header,
          accountId: 'other-header',
          code: '401000',
          functionalBalance: 50n,
        },
        {
          ...header,
          accountId: 'nested-control',
          controlAccountId: header.accountId,
          functionalBalance: 900n,
        },
        { ...account, functionalBalance: 40n, transactionCount: 2n },
        {
          ...account,
          accountId: 'nested-posting',
          controlAccountId: 'nested-control',
          functionalBalance: 60n,
          transactionCount: 3n,
        },
        {
          ...header,
          accountId: 'expense-header',
          type: 'expense',
          code: '500000',
          functionalBalance: 300n,
        },
        {
          ...account,
          accountId: 'expense-posting',
          type: 'expense',
          code: '500001',
          functionalBalance: 30n,
        },
      ]);
      const response = await usecase({});
      expect(response.data.map((row) => row.accountId)).toEqual([
        'sales',
        'nested-posting',
        'expense-posting',
      ]);
      expect(response.data.map((row) => row.sharePercentage)).toEqual([
        20, 30, 10,
      ]);
      expect(response.data.map((row) => row.transactionCount)).toEqual([
        2, 3, 128,
      ]);
      expect(response.meta.total).toBe(3);
      const filtered = await usecase({ type: 'revenue', page: 2, limit: 1 });
      expect(filtered.data[0].sharePercentage).toBe(30);
      expect(filtered.meta.total).toBe(2);
    });

    it('returns no table rows when only headers exist', async () => {
      mockRevenueExpenseAccountsRepoQuery.mockResolvedValue([header]);
      const response = await usecase({});
      expect(response.data).toEqual([]);
      expect(response.meta.total).toBe(0);
    });

    it('rejects a missing header balance rather than substituting posting totals', async () => {
      mockRevenueExpenseAccountsRepoQuery.mockResolvedValue([
        { ...header, functionalBalance: null },
        account,
      ]);
      await expect(usecase({})).rejects.toThrow(ledgerAppError.BalanceNotFound);
    });

    it('propagates storage failures', async () => {
      const failure = new Error('read failed');
      mockRevenueExpenseAccountsRepoQuery.mockRejectedValue(failure);
      await expect(usecase({})).rejects.toBe(failure);
    });
  });
});
