import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';

import mockAppContext, {
  mockClientSession,
} from '@app/context/contracts/__mocks__/app-context.mock';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import mockAssetLiabilityAccountParticipationQueryRepo from '@app/reporting/contracts/__mocks__/asset-liability-account-participation.query.repo.mock';
import { IAssetLiabilityAccountBalance } from '@app/reporting/contracts/asset-liability-account-participation.query.repo.contract';
import { IGetAssetLiabilityAccountParticipationQuery } from '@app/reporting/dtos/asset-liability-account-participation/asset-liability-account-participation.dto';
import reportingError from '@app/reporting/errors/reporting.error';
import makeGetAssetLiabilityAccountParticipationUsecase from '@app/reporting/usecases/get-asset-liability-account-participation.usecase';

const entityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
const account: IAssetLiabilityAccountBalance = {
  accountId: 'operating',
  accountName: 'Operating account',
  code: '100001',
  type: 'asset',
  subType: 'cash_and_cash_equivalent',
  status: 'active',
  isControlAccount: false,
  controlAccountId: 'cash-header',
  functionalBalance: 5_400_000_00n,
};
const header: IAssetLiabilityAccountBalance = {
  ...account,
  accountId: 'cash-header',
  code: '100000',
  isControlAccount: true,
  controlAccountId: null,
};

describe('getAssetLiabilityAccountParticipationUsecase', () => {
  const usecase = makeGetAssetLiabilityAccountParticipationUsecase({
    appContext: mockAppContext,
    assetLiabilityAccountParticipationQueryRepo:
      mockAssetLiabilityAccountParticipationQueryRepo,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      accountingEntity: {
        id: entityId,
        functionalCurrencyCode: 'NGN',
      } as IAccountingEntity,
      correlationId: 'participation-spec',
      idempotencyKey: '',
      clientSession: mockClientSession,
    });
    mockAssetLiabilityAccountParticipationQueryRepo.findAll.mockResolvedValue(
      []
    );
  });

  it('reads balances once for the active entity and functional currency', async () => {
    expect(await usecase({})).toEqual({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
    expect(mockAppContext.get).toHaveBeenCalledWith(['accountingEntity']);
    expect(
      mockAssetLiabilityAccountParticipationQueryRepo.findAll
    ).toHaveBeenCalledTimes(1);
    expect(
      mockAssetLiabilityAccountParticipationQueryRepo.findAll
    ).toHaveBeenCalledWith(entityId, 'NGN', {
      correlationId: 'participation-spec',
    });
  });

  it('returns individual functional balances and shares of the respective asset or liability total', async () => {
    mockAssetLiabilityAccountParticipationQueryRepo.findAll.mockResolvedValue([
      { ...header, functionalBalance: 15_700_000_00n },
      {
        ...header,
        accountId: 'liability-header',
        type: 'liability',
        functionalBalance: 3_200_000_00n,
      },
      account,
      { ...account, accountId: 'savings', functionalBalance: 4_200_000_00n },
      {
        ...account,
        accountId: 'loan',
        type: 'liability',
        functionalBalance: 2_400_000_00n,
      },
      {
        ...account,
        accountId: 'payable',
        type: 'liability',
        functionalBalance: 400_000_00n,
      },
    ]);
    const response = await usecase({});
    expect(response.data[0]).toEqual({
      accountId: 'operating',
      accountName: 'Operating account',
      code: '100001',
      type: 'asset',
      subType: 'cash_and_cash_equivalent',
      status: 'active',
      amount: { amount: 5_400_000_00, currencyCode: 'NGN', isMinorUnit: true },
      sharePercentage: 34.39,
    });
    expect(response.data.map((row) => row.sharePercentage)).toEqual([
      34.39, 26.75, 75, 12.5,
    ]);
    expect(response.meta.total).toBe(4);
  });

  it('totals roots once, includes root suspense and omits nested controls from rows and totals', async () => {
    mockAssetLiabilityAccountParticipationQueryRepo.findAll.mockResolvedValue([
      { ...header, functionalBalance: 100n },
      { ...header, accountId: 'second-root', functionalBalance: 50n },
      {
        ...header,
        accountId: 'nested-control',
        controlAccountId: header.accountId,
        functionalBalance: 900n,
      },
      {
        ...account,
        controlAccountId: 'nested-control',
        functionalBalance: 40n,
      },
      {
        ...account,
        accountId: 'suspense',
        subType: 'suspense',
        controlAccountId: null,
        functionalBalance: 50n,
      },
    ]);
    const response = await usecase({});
    expect(response.data.map((row) => row.accountId)).toEqual([
      'operating',
      'suspense',
    ]);
    expect(response.data.map((row) => row.sharePercentage)).toEqual([20, 25]);
    expect(response.meta.total).toBe(2);
  });

  it('preserves full totals through type filters, case-insensitive name/code search and pagination', async () => {
    mockAssetLiabilityAccountParticipationQueryRepo.findAll.mockResolvedValue([
      { ...header, functionalBalance: 200n },
      {
        ...header,
        accountId: 'liabilities',
        type: 'liability',
        functionalBalance: 400n,
      },
      { ...account, functionalBalance: 40n },
      {
        ...account,
        accountId: 'savings',
        accountName: 'Savings',
        code: '100002',
        functionalBalance: 60n,
      },
      {
        ...account,
        accountId: 'loan',
        type: 'liability',
        functionalBalance: 300n,
      },
    ]);
    const searched = await usecase({ search: 'SAV', type: 'asset' });
    expect(searched.data[0].sharePercentage).toBe(30);
    expect(searched.meta.total).toBe(1);
    const paged = await usecase({ type: 'asset', page: 2, limit: 1 });
    expect(paged.data[0].accountId).toBe('savings');
    expect(paged.data[0].sharePercentage).toBe(30);
    expect(paged.meta).toEqual({ page: 2, limit: 1, total: 2, totalPages: 2 });
    expect((await usecase({ search: '100002' })).data[0].accountId).toBe(
      'savings'
    );
    expect((await usecase({ type: 'liability' })).data[0].sharePercentage).toBe(
      75
    );
    expect((await usecase({ search: 'missing' })).data).toEqual([]);
    expect((await usecase({ page: 5, limit: 1 })).data).toEqual([]);
  });

  it('keeps signed and zero balances in every status and returns null shares for zero totals', async () => {
    mockAssetLiabilityAccountParticipationQueryRepo.findAll.mockResolvedValue([
      { ...header, functionalBalance: 0n },
      { ...account, status: 'draft', functionalBalance: 0n },
      {
        ...account,
        accountId: 'negative',
        status: 'archived',
        functionalBalance: -50n,
      },
      { ...account, accountId: 'positive', functionalBalance: 50n },
    ]);
    const response = await usecase({});
    expect(response.data.map((row) => row.amount.amount)).toEqual([0, -50, 50]);
    expect(response.data.map((row) => row.status)).toEqual([
      'draft',
      'archived',
      'active',
    ]);
    expect(response.data.map((row) => row.sharePercentage)).toEqual([
      null,
      null,
      null,
    ]);
  });

  it('does not clamp signed shares or replace a negative denominator', async () => {
    mockAssetLiabilityAccountParticipationQueryRepo.findAll.mockResolvedValue([
      { ...header, functionalBalance: -100n },
      { ...account, functionalBalance: -150n },
      { ...account, accountId: 'offset', functionalBalance: 50n },
    ]);
    expect((await usecase({})).data.map((row) => row.sharePercentage)).toEqual([
      150, -50,
    ]);
  });

  it('returns no posting rows when only headers exist', async () => {
    mockAssetLiabilityAccountParticipationQueryRepo.findAll.mockResolvedValue([
      header,
    ]);
    expect((await usecase({})).data).toEqual([]);
  });

  it.each([
    { page: 0 },
    { page: 1.5 },
    { limit: 0 },
    { limit: 201 },
    { limit: 1.5 },
    { search: 123 },
    { type: 'revenue' },
  ])('rejects invalid query %j before storage', async (query) => {
    await expect(
      usecase(query as IGetAssetLiabilityAccountParticipationQuery)
    ).rejects.toThrow(appError.UnprocessableEntity);
    expect(
      mockAssetLiabilityAccountParticipationQueryRepo.findAll
    ).not.toHaveBeenCalled();
  });

  it.each([account, header])(
    'rejects missing balance for $accountId',
    async (balance) => {
      mockAssetLiabilityAccountParticipationQueryRepo.findAll.mockResolvedValue(
        [{ ...balance, functionalBalance: null }]
      );
      await expect(usecase({})).rejects.toThrow(ledgerAppError.BalanceNotFound);
    }
  );

  it.each([100_000_000_000_001n, -100_000_000_000_001n])(
    'rejects excessive balance %s',
    async (functionalBalance) => {
      mockAssetLiabilityAccountParticipationQueryRepo.findAll.mockResolvedValue(
        [{ ...account, functionalBalance }]
      );
      await expect(usecase({})).rejects.toThrow(
        reportingError.ReportAmountLimitExceeded
      );
    }
  );

  it('checks the full total before filtering out rows', async () => {
    mockAssetLiabilityAccountParticipationQueryRepo.findAll.mockResolvedValue([
      { ...header, functionalBalance: 60_000_000_000_000n },
      {
        ...header,
        accountId: 'other-root',
        functionalBalance: 60_000_000_000_000n,
      },
    ]);
    await expect(usecase({ search: 'missing' })).rejects.toThrow(
      reportingError.ReportAmountLimitExceeded
    );
  });

  it('propagates storage failures', async () => {
    const failure = new Error('read failed');
    mockAssetLiabilityAccountParticipationQueryRepo.findAll.mockRejectedValue(
      failure
    );
    await expect(usecase({})).rejects.toBe(failure);
  });
});
