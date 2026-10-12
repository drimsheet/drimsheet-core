import { TEntityId } from '@shared/types/uuid';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import { IBankDetails } from '@domain/ledger/types/asset-account.types';
import {
  ELedgerAccountStatus,
  ILedgerAccount,
} from '@domain/ledger/types/ledger.types';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import {
  mockBankAccountRepo,
  mockLedgerAccountRepo,
} from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import makeGetBankDetailsUsecase from '@app/ledger/usecases/get-bank-details.usecase';

describe('getBankDetailsUsecase', () => {
  const accountId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  const accountingEntityId =
    '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
  const correlationId = 'bank-details-correlation';
  const bankDetails: IBankDetails = {
    countryCode: 'NG',
    bankName: 'Example Bank',
    accountName: 'Operating Account',
    accountNumber: '0123456789',
  };
  const account = {
    id: accountId,
    accountingEntityId,
    behavior: 'bank',
    status: ELedgerAccountStatus.Active,
    meta: null,
  } as ILedgerAccount;
  const useCase = makeGetBankDetailsUsecase({
    appContext: mockAppContext,
    ledgerAccountRepo: mockLedgerAccountRepo,
    bankAccountRepo: mockBankAccountRepo,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      correlationId,
      accountingEntity: { id: accountingEntityId } as IAccountingEntity,
    } as ReturnType<typeof mockAppContext.get>);
    mockLedgerAccountRepo.findById.mockResolvedValue(account);
    mockBankAccountRepo.findByLedgerAccountId.mockResolvedValue(bankDetails);
  });

  it('returns stored bank details after an accounting-entity-scoped account lookup', async () => {
    await expect(useCase(accountId)).resolves.toEqual(bankDetails);
    expect(mockLedgerAccountRepo.findById).toHaveBeenCalledWith(
      accountId,
      accountingEntityId,
      { correlationId }
    );
    expect(mockBankAccountRepo.findByLedgerAccountId).toHaveBeenCalledWith(
      accountId,
      { correlationId }
    );
    expect(
      mockLedgerAccountRepo.findById.mock.invocationCallOrder[0]
    ).toBeLessThan(
      mockBankAccountRepo.findByLedgerAccountId.mock.invocationCallOrder[0]
    );
  });

  it('rejects an invalid ID before reading context or repositories', async () => {
    await expect(useCase('invalid-id' as TEntityId)).rejects.toThrow(
      ledgerAccountError.InvalidId
    );
    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
    expect(mockBankAccountRepo.findByLedgerAccountId).not.toHaveBeenCalled();
  });

  it('rejects an account absent from the active accounting entity before reading bank details', async () => {
    mockLedgerAccountRepo.findById.mockResolvedValue(null);
    await expect(useCase(accountId)).rejects.toThrow(
      ledgerAppError.AccountNotFound
    );
    expect(mockBankAccountRepo.findByLedgerAccountId).not.toHaveBeenCalled();
  });

  it('rejects a non-bank account before reading bank details', async () => {
    mockLedgerAccountRepo.findById.mockResolvedValue({
      ...account,
      behavior: 'petty_cash',
    });
    await expect(useCase(accountId)).rejects.toThrow(
      ledgerAccountError.InvalidBehavior
    );
    expect(mockBankAccountRepo.findByLedgerAccountId).not.toHaveBeenCalled();
  });

  it('reports missing bank details as an unexpected state', async () => {
    mockBankAccountRepo.findByLedgerAccountId.mockResolvedValue(null);
    await expect(useCase(accountId)).rejects.toThrow(
      ledgerAccountError.BankDetailsMissing
    );
  });

  it('allows reading bank details for an archived bank account', async () => {
    mockLedgerAccountRepo.findById.mockResolvedValue({
      ...account,
      status: ELedgerAccountStatus.Archived,
    });
    await expect(useCase(accountId)).resolves.toEqual(bankDetails);
  });

  it('propagates repository failures', async () => {
    const failure = new ledgerAccountError.BankDetailsMissing();
    mockBankAccountRepo.findByLedgerAccountId.mockRejectedValue(failure);
    await expect(useCase(accountId)).rejects.toBe(failure);
  });
});
