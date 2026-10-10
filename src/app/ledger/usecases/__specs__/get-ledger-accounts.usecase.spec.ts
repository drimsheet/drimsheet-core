import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import { EAccountingEntityType } from '@domain/accounting/types/accounting-entity.types';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import makeCashAccountService from '@domain/ledger/services/asset-account/cash-account.service';
import { ICashAndCashEquivalentAccount } from '@domain/ledger/types/asset-account.types';
import currencyEntity from '@domain/money/entities/currency.entity';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/contracts/app-context.contract';
import mockLedgerAccountBalanceEnrichmentAppService from '@app/ledger/contracts/__mocks__/ledger-account-balance-enrichment.service.mock';
import { mockLedgerCodeAllocationService } from '@app/ledger/contracts/__mocks__/ledger.domain.services.mock';
import {
  mockBankAccountRepo,
  mockLedgerAccountRepo,
} from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import {
  IGetLedgerAccountsQuery,
  ILedgerAccountDto,
} from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import makeGetLedgerAccountsUsecase from '@app/ledger/usecases/get-ledger-accounts.usecase';

describe('makeGetLedgerAccountsUsecase', () => {
  const getUseCase = () =>
    makeGetLedgerAccountsUsecase({
      appContext: mockAppContext,
      ledgerAccountRepo: mockLedgerAccountRepo,
      balanceEnrichmentAppService: mockLedgerAccountBalanceEnrichmentAppService,
    });

  const usdCurrency = currencyEntity.getByCode('USD');

  const [accountingEntity] = accountingEntityEntity.make({
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    name: 'Test Business',
    type: EAccountingEntityType.Individual,
    ownerId: generateUUID(),
    functionalCurrencyCode: 'USD',
    jurisdictionCode: 'US',
  });

  const correlationId = 'test-corr-id';

  const cashAccountService = makeCashAccountService({
    ledgerAccountRepo: mockLedgerAccountRepo,
    bankAccountRepo: mockBankAccountRepo,
    ledgerCodeAllocationService: mockLedgerCodeAllocationService,
  });
  let ledgerAccount: ICashAndCashEquivalentAccount;
  let controlAccount: ICashAndCashEquivalentAccount;

  beforeAll(async () => {
    const userId = generateUUID();
    const [cashHeader] = await cashAccountService.createHeader(
      {
        name: 'Cash and Cash Equivalents',
        accountingEntity,
        createdBy: userId,
      },
      { correlationId }
    );
    [ledgerAccount] = ledgerAccountEntity.make<ICashAndCashEquivalentAccount>({
      ...cashHeader,
      code: '100001',
      materializedPath: '100000.100001',
      behavior: 'bank',
      name: 'Operations Bank Account',
      isControlAccount: false,
      controlAccountId: cashHeader.id,
      currency: usdCurrency,
      createdBy: userId,
      accountingEntityId: accountingEntity.id,
      meta: {
        countryCode: 'US',
        bankName: 'Test Bank',
        accountNumber: '1234567890',
        accountName: 'Main Account',
      },
    });
    controlAccount = cashHeader;
  });

  const validQuery: IGetLedgerAccountsQuery = {
    page: 1,
    limit: 10,
    orderBy: 'accountName',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAppContext.get.mockReturnValue({
      correlationId,
      accountingEntity,
    } as IAppContextData);
    mockLedgerAccountBalanceEnrichmentAppService.enrich.mockResolvedValue([]);
  });

  it('throws ZodError for invalid query', async () => {
    const useCase = getUseCase();
    const invalidQuery = {
      page: 0, // Invalid: page must be >= 1
    } as IGetLedgerAccountsQuery;

    await expect(useCase(invalidQuery)).rejects.toThrow();

    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockLedgerAccountRepo.findAll).not.toHaveBeenCalled();
    expect(
      mockLedgerAccountBalanceEnrichmentAppService.enrich
    ).not.toHaveBeenCalled();
  });

  it('returns empty data when ledger account repo returns empty', async () => {
    mockLedgerAccountRepo.findAll.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });

    const useCase = getUseCase();
    const result = await useCase(validQuery);

    expect(
      mockLedgerAccountBalanceEnrichmentAppService.enrich
    ).toHaveBeenCalledWith([], accountingEntity, { correlationId });
    expect(result).toEqual({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
  });

  it('enriches the selected account page and preserves pagination metadata', async () => {
    mockLedgerAccountRepo.findAll.mockResolvedValue({
      data: [ledgerAccount, controlAccount],
      meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
    });
    const enrichedDtos = [
      {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id: ledgerAccount.id,
      },
      {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id: controlAccount.id,
      },
    ] as ILedgerAccountDto[];
    mockLedgerAccountBalanceEnrichmentAppService.enrich.mockResolvedValue(
      enrichedDtos
    );

    const useCase = getUseCase();
    const result = await useCase(validQuery);

    expect(mockLedgerAccountRepo.findAll).toHaveBeenCalledWith(
      accountingEntity.id,
      {
        ...validQuery,
        status: 'active',
        offset: 0,
        correlationId,
      }
    );
    expect(
      mockLedgerAccountBalanceEnrichmentAppService.enrich
    ).toHaveBeenCalledWith([ledgerAccount, controlAccount], accountingEntity, {
      correlationId,
    });
    expect(result).toEqual({
      data: enrichedDtos,
      meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
    });
  });
  it.each(['active', 'draft', 'archived'] as const)(
    'honors explicit %s lifecycle selection',
    async (status) => {
      mockLedgerAccountRepo.findAll.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
      });
      await getUseCase()({ ...validQuery, status });
      expect(mockLedgerAccountRepo.findAll).toHaveBeenCalledWith(
        accountingEntity.id,
        expect.objectContaining({ status })
      );
    }
  );
});
