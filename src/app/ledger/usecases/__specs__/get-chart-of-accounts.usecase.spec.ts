import { TEntityId } from '@shared/types/uuid';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import {
  EAdjunctAccountRule,
  EContraAccountRule,
  ELedgerAccountStatus,
  ELedgerType,
  ENormalBalance,
  ILedgerAccount,
} from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import mockLedgerAccountBalanceEnrichmentAppService from '@app/ledger/contracts/__mocks__/ledger-account-balance-enrichment.service.mock';
import mockLedgerAccountQueryRepo from '@app/ledger/contracts/__mocks__/ledger-account.query.repo.mock';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import makeGetChartOfAccountsUsecase from '@app/ledger/usecases/get-chart-of-accounts.usecase';

describe('getChartOfAccountsUsecase', () => {
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000' as TEntityId;
  const mockAccountId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  const mockAccountingEntityId =
    '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
  const correlationId = 'test-corr-id';

  const useCase = makeGetChartOfAccountsUsecase({
    appContext: mockAppContext,
    ledgerAccountQueryRepo: mockLedgerAccountQueryRepo,
    balanceEnrichmentAppService: mockLedgerAccountBalanceEnrichmentAppService,
  });

  const mockAccountingEntity = {
    id: mockAccountingEntityId,
    functionalCurrencyCode: SYSTEM_CURRENCIES.USD.code,
  } as unknown as IAccountingEntity;

  const validAccountData = {
    code: '100000',
    accountingEntityId: mockAccountingEntityId,
    type: ELedgerType.Asset,
    materializedPath: '100000',
    normalBalance: ENormalBalance.Debit,
    subType: 'test',
    behavior: 'test',
    isControlAccount: false,
    controlAccountId: null,
    name: 'Test Account',
    currency: SYSTEM_CURRENCIES.EUR,
    status: ELedgerAccountStatus.Active,
    contraAccountRule: EContraAccountRule.ContraNotPermitted,
    adjunctAccountRule: EAdjunctAccountRule.AdjunctNotPermitted,
    meta: null,
    createdBy: mockUserId,
  };

  const [mockLedgerAccount] =
    ledgerAccountEntity.make<ILedgerAccount>(validAccountData);
  const accountWithId = { ...mockLedgerAccount, id: mockAccountId };
  const enrichedDto: ILedgerAccountDto = {
    id: mockAccountId,
    code: accountWithId.code,
    materializedPath: accountWithId.materializedPath,
    accountingEntityId: mockAccountingEntityId,
    type: ELedgerType.Asset,
    normalBalance: ENormalBalance.Debit,
    subType: 'cash_and_cash_equivalent',
    behavior: 'bank',
    isControlAccount: true,
    name: 'Cash',
    status: ELedgerAccountStatus.Active,
    contraAccountRule: EContraAccountRule.ContraNotPermitted,
    adjunctAccountRule: EAdjunctAccountRule.AdjunctNotPermitted,
    openingBalanceDate: null,
    createdBy: mockUserId,
    createdAt: accountWithId.createdAt,
    updatedAt: accountWithId.updatedAt,
    balance: { amount: 10000, currencyCode: 'EUR', isMinorUnit: true },
    functionalBalance: {
      amount: 12000,
      currencyCode: 'USD',
      isMinorUnit: true,
    },
  };

  beforeEach(() => {
    jest.resetAllMocks();

    mockAppContext.get.mockReturnValue({
      correlationId,
      accountingEntity: mockAccountingEntity,
      idempotencyKey: 'mock-idempotency-key',
      clientSession: {
        setRefreshToken: jest.fn(),
        getRefreshToken: jest.fn(),
        clearRefreshToken: jest.fn(),
      },
    } as unknown as ReturnType<typeof mockAppContext.get>);
    mockLedgerAccountQueryRepo.findChartOfAccounts.mockResolvedValue([
      accountWithId,
    ]);
    mockLedgerAccountBalanceEnrichmentAppService.enrich.mockResolvedValue([
      enrichedDto,
    ]);
  });

  it.each(Object.values(ELedgerType))(
    'queries the complete %s class in the current entity and enriches the tree',
    async (accountClass) => {
      const result = await useCase({ class: accountClass });
      expect(
        mockLedgerAccountQueryRepo.findChartOfAccounts
      ).toHaveBeenCalledWith(mockAccountingEntityId, accountClass, {
        correlationId,
      });
      expect(
        mockLedgerAccountBalanceEnrichmentAppService.enrich
      ).toHaveBeenCalledWith([accountWithId], mockAccountingEntity, {
        correlationId,
      });
      expect(result).toEqual([{ ...enrichedDto, children: [] }]);
    }
  );

  it('passes header omission through to the tree mapper', async () => {
    const child = {
      ...enrichedDto,
      id: '123e4567-e89b-12d3-a456-426614174015' as TEntityId,
      controlAccountId: mockAccountId,
    };
    mockLedgerAccountBalanceEnrichmentAppService.enrich.mockResolvedValue([
      enrichedDto,
      child,
    ]);
    await expect(
      useCase({ class: 'asset', omitHeaderAccounts: true })
    ).resolves.toEqual([{ ...child, children: [] }]);
  });

  it('returns an empty tree when no accounts match', async () => {
    mockLedgerAccountQueryRepo.findChartOfAccounts.mockResolvedValue([]);
    mockLedgerAccountBalanceEnrichmentAppService.enrich.mockResolvedValue([]);
    await expect(useCase({ class: 'asset' })).resolves.toEqual([]);
  });

  it('searches the complete enriched hierarchy after omitting headers', async () => {
    const matchingChild = {
      ...enrichedDto,
      id: '123e4567-e89b-12d3-a456-426614174015' as TEntityId,
      controlAccountId: mockAccountId,
      name: 'Cash in Bank',
    };
    const descendant = {
      ...matchingChild,
      id: '123e4567-e89b-12d3-a456-426614174016' as TEntityId,
      controlAccountId: matchingChild.id,
      name: 'Savings',
    };
    mockLedgerAccountBalanceEnrichmentAppService.enrich.mockResolvedValue([
      enrichedDto,
      matchingChild,
      descendant,
    ]);

    await expect(
      useCase({ class: 'asset', search: 'CASH', omitHeaderAccounts: true })
    ).resolves.toEqual([
      { ...matchingChild, children: [{ ...descendant, children: [] }] },
    ]);
    expect(mockLedgerAccountQueryRepo.findChartOfAccounts).toHaveBeenCalledWith(
      mockAccountingEntityId,
      'asset',
      { correlationId }
    );
  });

  it.each([
    {},
    { class: 'invalid' },
    { class: 'asset', omitHeaderAccounts: 'true' },
    { class: 'asset', search: 123 },
  ])(
    'rejects invalid input %j before reading context or accounts',
    async (query) => {
      await expect(
        useCase(query as Parameters<typeof useCase>[0])
      ).rejects.toThrow();
      expect(mockAppContext.get).not.toHaveBeenCalled();
      expect(
        mockLedgerAccountQueryRepo.findChartOfAccounts
      ).not.toHaveBeenCalled();
      expect(
        mockLedgerAccountBalanceEnrichmentAppService.enrich
      ).not.toHaveBeenCalled();
    }
  );

  it('propagates query failures without enriching', async () => {
    const failure = new Error('query failed');
    mockLedgerAccountQueryRepo.findChartOfAccounts.mockRejectedValue(failure);
    await expect(useCase({ class: 'asset' })).rejects.toBe(failure);
    expect(
      mockLedgerAccountBalanceEnrichmentAppService.enrich
    ).not.toHaveBeenCalled();
  });

  it('propagates enrichment failures', async () => {
    const failure = new Error('enrichment failed');
    mockLedgerAccountBalanceEnrichmentAppService.enrich.mockRejectedValue(
      failure
    );
    await expect(useCase({ class: 'asset' })).rejects.toBe(failure);
  });
});
