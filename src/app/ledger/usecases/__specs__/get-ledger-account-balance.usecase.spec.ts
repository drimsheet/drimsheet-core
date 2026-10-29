import { TEntityId } from '@shared/types/uuid';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import { ILedgerAccountBalance } from '@domain/ledger/types/ledger-account-balance.types';
import {
  EAdjunctAccountRule,
  EContraAccountRule,
  ELedgerAccountStatus,
  ELedgerType,
  ENormalBalance,
  ILedgerAccount,
} from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import {
  mockLedgerAccountBalanceRepo,
  mockLedgerAccountRepo,
} from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import makeGetLedgerAccountBalanceUsecase from '@app/ledger/usecases/get-ledger-account-balance.usecase';

describe('getLedgerAccountBalanceUseCase', () => {
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000' as TEntityId;
  const mockAccountId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  const mockAccountingEntityId =
    '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
  const correlationId = 'test-corr-id';

  const useCase = makeGetLedgerAccountBalanceUsecase({
    appContext: mockAppContext,
    ledgerAccountRepo: mockLedgerAccountRepo,
    ledgerAccountBalanceRepo: mockLedgerAccountBalanceRepo,
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
  const now = new Date('2026-10-26T10:00:00.000Z');
  const accountBalance: ILedgerAccountBalance = {
    createdBy: mockUserId,
    ledgerAccountId: mockAccountId,
    accountingEntityId: mockAccountingEntityId,
    accountMaterializedPath: '100000',
    amount: moneyValue.make(10000, SYSTEM_CURRENCIES.EUR, true),
    functionalAmount: moneyValue.make(12000, SYSTEM_CURRENCIES.USD, true),
    version: 2,
    createdAt: now,
    updatedAt: now,
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
    mockLedgerAccountBalanceRepo.findByAccountId.mockResolvedValue(
      accountBalance
    );
  });

  it.each(['', 'abc', '10000', '1000000', '000000', '600000', ' 100000'])(
    'rejects invalid code %s before reading context or repositories',
    async (code) => {
      await expect(useCase(code)).rejects.toMatchObject({
        validationErrors: [
          {
            field: 'code',
            message: 'ledger_error_ledger_account_code_invalid',
          },
        ],
      });
      expect(mockAppContext.get).not.toHaveBeenCalled();
      expect(mockLedgerAccountRepo.findByCode).not.toHaveBeenCalled();
      expect(
        mockLedgerAccountBalanceRepo.findByAccountId
      ).not.toHaveBeenCalled();
    }
  );

  it('throws app_error_ledger_account_not_found if account is not found', async () => {
    mockLedgerAccountRepo.findByCode.mockResolvedValue(null);

    await expect(useCase('100000')).rejects.toThrow(
      'app_error_ledger_account_not_found'
    );
    expect(mockLedgerAccountRepo.findByCode).toHaveBeenCalledWith(
      '100000',
      mockAccountingEntityId,
      { correlationId }
    );
    expect(mockLedgerAccountBalanceRepo.findByAccountId).not.toHaveBeenCalled();
  });

  it('rejects a missing balance instead of fabricating a zero balance', async () => {
    mockLedgerAccountRepo.findByCode.mockResolvedValue(accountWithId);
    mockLedgerAccountBalanceRepo.findByAccountId.mockResolvedValue(null);
    await expect(useCase('100000')).rejects.toThrow(
      'app_error_ledger_balance_missing_unexpected'
    );
  });

  it('returns the stored balance with money DTOs and entity-scoped reads', async () => {
    mockLedgerAccountRepo.findByCode.mockResolvedValue(accountWithId);

    const result = await useCase('100000');

    expect(mockLedgerAccountBalanceRepo.findByAccountId).toHaveBeenCalledWith(
      mockAccountId,
      mockAccountingEntityId,
      { correlationId }
    );
    expect(mockLedgerAccountRepo.findByCode).toHaveBeenCalledWith(
      '100000',
      mockAccountingEntityId,
      { correlationId }
    );
    expect(result).toEqual({
      createdBy: mockUserId,
      ledgerAccountId: mockAccountId,
      accountingEntityId: mockAccountingEntityId,
      accountMaterializedPath: '100000',
      amount: { amount: 10000, currencyCode: 'EUR', isMinorUnit: true },
      functionalAmount: {
        amount: 12000,
        currencyCode: 'USD',
        isMinorUnit: true,
      },
      version: 2,
      createdAt: now,
      updatedAt: now,
    });
  });
});
