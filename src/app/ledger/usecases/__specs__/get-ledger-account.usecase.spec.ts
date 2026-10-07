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
import mockLedgerAccountBalanceEnrichmentService from '@app/ledger/contracts/__mocks__/ledger-account-balance-enrichment.service.mock';
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import makeGetLedgerAccountUseCase from '@app/ledger/usecases/get-ledger-account.usecase';

describe('getLedgerAccountUseCase', () => {
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000' as TEntityId;
  const mockAccountId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  const mockAccountingEntityId =
    '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
  const correlationId = 'test-corr-id';

  const useCase = makeGetLedgerAccountUseCase({
    appContext: mockAppContext,
    ledgerAccountRepo: mockLedgerAccountRepo,
    balanceEnrichmentService: mockLedgerAccountBalanceEnrichmentService,
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
  const enrichedDto = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: mockAccountId,
    balance: {
      amount: 10000,
      currencyCode: SYSTEM_CURRENCIES.EUR.code,
      isMinorUnit: true,
    },
    functionalBalance: {
      amount: 12000,
      currencyCode: SYSTEM_CURRENCIES.USD.code,
      isMinorUnit: true,
    },
  } as ILedgerAccountDto;

  beforeEach(() => {
    jest.clearAllMocks();

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
    mockLedgerAccountBalanceEnrichmentService.enrich.mockResolvedValue([
      enrichedDto,
    ]);
  });

  it('throws ledger_error_id_invalid if accountId is not a valid UUID', async () => {
    await expect(useCase('invalid-id' as TEntityId)).rejects.toThrow(
      'ledger_error_id_invalid'
    );

    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
    expect(
      mockLedgerAccountBalanceEnrichmentService.enrich
    ).not.toHaveBeenCalled();
  });

  it('throws app_error_ledger_account_not_found if account is not found', async () => {
    mockLedgerAccountRepo.findById.mockResolvedValue(null);

    await expect(useCase(mockAccountId)).rejects.toThrow(
      'app_error_ledger_account_not_found'
    );
    expect(mockLedgerAccountRepo.findById).toHaveBeenCalledWith(
      mockAccountId,
      mockAccountingEntityId,
      { correlationId }
    );
    expect(
      mockLedgerAccountBalanceEnrichmentService.enrich
    ).not.toHaveBeenCalled();
  });

  it('enriches the selected account and returns the service dto', async () => {
    mockLedgerAccountRepo.findById.mockResolvedValue(accountWithId);

    const result = await useCase(mockAccountId);

    expect(
      mockLedgerAccountBalanceEnrichmentService.enrich
    ).toHaveBeenCalledWith([accountWithId], mockAccountingEntity, {
      correlationId,
    });
    expect(
      mockLedgerAccountRepo.findById.mock.invocationCallOrder[0]
    ).toBeLessThan(
      mockLedgerAccountBalanceEnrichmentService.enrich.mock
        .invocationCallOrder[0]
    );
    expect(result).toBe(enrichedDto);
  });
});
