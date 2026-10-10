import { TEntityId } from '@shared/types/uuid';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { EJournalEntrySourceType } from '@domain/journal-entry/types/journal-entry.types';
import {
  EAssetAccountBehavior,
  EAssetSubType,
} from '@domain/ledger/types/asset-account.types';
import { EEquitySubType } from '@domain/ledger/types/equity-account.types';
import { EExpenseSubType } from '@domain/ledger/types/expense-account.types';
import { ELedgerAccountSubType } from '@domain/ledger/types/ledger-aggregate.types';
import {
  EAdjunctAccountRule,
  EContraAccountRule,
  ELedgerAccountStatus,
  ELedgerType,
  ENormalBalance,
  ILedgerAccount,
} from '@domain/ledger/types/ledger.types';
import {
  ELiabilityAccountBehavior,
  ELiabilitySubType,
} from '@domain/ledger/types/liability-account.types';
import currencyEntity from '@domain/money/entities/currency.entity';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/contracts/app-context.contract';
import mockLedgerAccountBalanceEnrichmentAppService from '@app/ledger/contracts/__mocks__/ledger-account-balance-enrichment.service.mock';
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import { IGetPermittedPostingAccountsQuery } from '@app/ledger/dtos/permitted-posting-account/permitted-posting-account.dto';
import makeGetPermittedPostingAccountsUsecase from '@app/ledger/usecases/get-permitted-posting-accounts.usecase';

describe('makeGetPermittedPostingAccountsUsecase', () => {
  const accountingEntityId =
    '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  const accountId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
  const userId = '123e4567-e89b-12d3-a456-426614174003' as TEntityId;
  const correlationId = 'permitted-posting-accounts-correlation-id';
  const now = new Date('2026-08-09T10:00:00.000Z');
  const usdCurrency = currencyEntity.getByCode('USD');

  const accountingEntity: IAccountingEntity = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: accountingEntityId,
    ownerId: userId,
    name: 'Posting Accounts Entity',
    type: 'individual',
    functionalCurrencyCode: 'USD',
    jurisdictionCode: 'US',
    createdAt: now,
    updatedAt: now,
  };

  const ledgerAccount: ILedgerAccount = {
    id: accountId,
    version: 1,
    code: '400001',
    materializedPath: '400000.400001',
    accountingEntityId,
    type: ELedgerType.Revenue,
    normalBalance: ENormalBalance.Credit,
    subType: 'operating_revenue',
    behavior: 'sales_revenue',
    isControlAccount: false,
    controlAccountId: null,
    name: 'Sales Revenue',
    currency: usdCurrency,
    status: ELedgerAccountStatus.Active,
    contraAccountRule: EContraAccountRule.ContraPermitted,
    adjunctAccountRule: EAdjunctAccountRule.AdjunctNotPermitted,
    meta: null,
    openingBalanceDate: null,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  const enrichedDto = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: accountId,
  } as ILedgerAccountDto;

  const validQuery: IGetPermittedPostingAccountsQuery = {
    sourceType: EJournalEntrySourceType.Receipt,
    side: 'source',
    page: 2,
    limit: 5,
  };

  const getUseCase = () =>
    makeGetPermittedPostingAccountsUsecase({
      appContext: mockAppContext,
      ledgerAccountRepo: mockLedgerAccountRepo,
      balanceEnrichmentAppService: mockLedgerAccountBalanceEnrichmentAppService,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAppContext.get.mockReturnValue({
      accountingEntity,
      correlationId,
    } as IAppContextData);
    mockLedgerAccountRepo.findAll.mockResolvedValue({
      data: [],
      meta: { page: 2, limit: 5, total: 0, totalPages: 0 },
    });
    mockLedgerAccountBalanceEnrichmentAppService.enrich.mockResolvedValue([]);
  });

  it('rejects an invalid request before repository reads', async () => {
    await expect(
      getUseCase()({
        ...validQuery,
        side: 'debit' as IGetPermittedPostingAccountsQuery['side'],
      })
    ).rejects.toThrow();

    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockLedgerAccountRepo.findAll).not.toHaveBeenCalled();
    expect(
      mockLedgerAccountBalanceEnrichmentAppService.enrich
    ).not.toHaveBeenCalled();
  });

  it('returns an empty page without repository reads when the valid source type has no rule', async () => {
    const result = await getUseCase()({
      ...validQuery,
      sourceType: EJournalEntrySourceType.Expense,
      page: 3,
    });

    expect(result).toEqual({
      data: [],
      meta: { page: 3, limit: 5, total: 0, totalPages: 0 },
    });
    expect(mockLedgerAccountRepo.findAll).not.toHaveBeenCalled();
    expect(
      mockLedgerAccountBalanceEnrichmentAppService.enrich
    ).not.toHaveBeenCalled();
  });

  it('translates receipt source sets into one paginated non-control account query', async () => {
    await getUseCase()(validQuery);

    expect(mockLedgerAccountRepo.findAll).toHaveBeenCalledWith(
      accountingEntityId,
      {
        statuses: ['active', 'draft'],
        types: [ELedgerType.Revenue, ELedgerType.Liability],
        subTypes: undefined,
        behaviors: undefined,
        currencyCodes: undefined,
        isControlAccount: false,
        limit: 5,
        offset: 5,
        correlationId,
      }
    );
  });

  it('selects receipt destination permits and normalizes fixed-or-null currency', async () => {
    await getUseCase()({
      ...validQuery,
      side: 'destination',
      currencyCode: 'usd',
    });

    expect(mockLedgerAccountRepo.findAll).toHaveBeenCalledWith(
      accountingEntityId,
      expect.objectContaining({
        types: [ELedgerType.Asset],
        subTypes: [EAssetSubType.CashAndCashEquivalent],
        behaviors: undefined,
        currencyCodes: ['USD', null],
        isControlAccount: false,
      })
    );
  });

  it('selects payment source behaviors', async () => {
    await getUseCase()({
      ...validQuery,
      sourceType: EJournalEntrySourceType.Payment,
    });

    expect(mockLedgerAccountRepo.findAll).toHaveBeenCalledWith(
      accountingEntityId,
      expect.objectContaining({
        types: undefined,
        subTypes: undefined,
        behaviors: [
          EAssetAccountBehavior.Bank,
          EAssetAccountBehavior.PettyCash,
          ELiabilityAccountBehavior.CreditCard,
        ],
      })
    );
  });

  it('selects payment destination subtypes', async () => {
    await getUseCase()({
      ...validQuery,
      sourceType: EJournalEntrySourceType.Payment,
      side: 'destination',
    });

    expect(mockLedgerAccountRepo.findAll).toHaveBeenCalledWith(
      accountingEntityId,
      expect.objectContaining({
        types: undefined,
        subTypes: expect.arrayContaining([
          ELiabilitySubType.Payable,
          EExpenseSubType.RentAndUtilities,
        ]),
        behaviors: undefined,
      })
    );
  });

  it('filters suspense from permitted payment destination subtypes when requested', async () => {
    await getUseCase()({
      ...validQuery,
      sourceType: EJournalEntrySourceType.Payment,
      side: 'destination',
      filterSuspense: true,
    });

    const accountRepoOptions = mockLedgerAccountRepo.findAll.mock.calls[0][1];

    expect(accountRepoOptions.subTypes).toEqual(
      expect.arrayContaining([
        ELiabilitySubType.Payable,
        EExpenseSubType.RentAndUtilities,
      ])
    );
    expect(accountRepoOptions.subTypes).not.toContain(
      ELedgerAccountSubType.Suspense
    );
  });

  it.each(['source', 'destination'] as const)(
    'selects transfer %s account permits',
    async (side) => {
      await getUseCase()({
        ...validQuery,
        sourceType: EJournalEntrySourceType.Transfer,
        side,
      });

      expect(mockLedgerAccountRepo.findAll).toHaveBeenCalledWith(
        accountingEntityId,
        expect.objectContaining({
          types: [ELedgerType.Asset],
          subTypes: [EAssetSubType.CashAndCashEquivalent],
          behaviors: [
            EAssetAccountBehavior.Bank,
            EAssetAccountBehavior.PettyCash,
          ],
        })
      );
    }
  );

  it('omits wildcard restrictions for the opening-balance source rule', async () => {
    await getUseCase()({
      ...validQuery,
      sourceType: EJournalEntrySourceType.OpeningBalance,
    });

    expect(mockLedgerAccountRepo.findAll).toHaveBeenCalledWith(
      accountingEntityId,
      expect.objectContaining({
        types: undefined,
        subTypes: undefined,
        behaviors: undefined,
      })
    );
  });

  it('expands wildcard subtypes without suspense when filtering is requested', async () => {
    await getUseCase()({
      ...validQuery,
      sourceType: EJournalEntrySourceType.OpeningBalance,
      filterSuspense: true,
    });

    expect(mockLedgerAccountRepo.findAll).toHaveBeenCalledWith(
      accountingEntityId,
      expect.objectContaining({
        subTypes: Object.values(ELedgerAccountSubType).filter(
          (subType) => subType !== ELedgerAccountSubType.Suspense
        ),
      })
    );
  });

  it('selects every opening-balance destination restriction', async () => {
    await getUseCase()({
      ...validQuery,
      sourceType: EJournalEntrySourceType.OpeningBalance,
      side: 'destination',
    });

    expect(mockLedgerAccountRepo.findAll).toHaveBeenCalledWith(
      accountingEntityId,
      expect.objectContaining({
        types: [ELedgerType.Equity],
        subTypes: [EEquitySubType.OpeningBalance],
        behaviors: ['opening_balance_equity'],
      })
    );
  });

  it('delegates an empty account page to enrichment and preserves metadata', async () => {
    const result = await getUseCase()(validQuery);

    expect(
      mockLedgerAccountBalanceEnrichmentAppService.enrich
    ).toHaveBeenCalledWith([], accountingEntity, { correlationId });
    expect(result).toEqual({
      data: [],
      meta: { page: 2, limit: 5, total: 0, totalPages: 0 },
    });
  });

  it('enriches page accounts and preserves pagination metadata', async () => {
    mockLedgerAccountRepo.findAll.mockResolvedValue({
      data: [ledgerAccount],
      meta: { page: 2, limit: 5, total: 6, totalPages: 2 },
    });
    mockLedgerAccountBalanceEnrichmentAppService.enrich.mockResolvedValue([
      enrichedDto,
    ]);

    const result = await getUseCase()(validQuery);

    expect(
      mockLedgerAccountBalanceEnrichmentAppService.enrich
    ).toHaveBeenCalledWith([ledgerAccount], accountingEntity, {
      correlationId,
    });
    expect(result).toEqual({
      data: [enrichedDto],
      meta: { page: 2, limit: 5, total: 6, totalPages: 2 },
    });
  });
});
