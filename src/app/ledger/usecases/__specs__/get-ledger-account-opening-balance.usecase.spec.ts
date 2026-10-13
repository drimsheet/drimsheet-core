import { TEntityId } from '@shared/types/uuid';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import {
  ELedgerAccountStatus,
  ILedgerAccount,
} from '@domain/ledger/types/ledger.types';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import mockJournalEntryQueryRepo from '@app/journal-entry/contracts/__mocks__/journal-entry.query.repo.mock';
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import makeGetLedgerAccountOpeningBalanceUsecase from '@app/ledger/usecases/get-ledger-account-opening-balance.usecase';

describe('getLedgerAccountOpeningBalanceUsecase', () => {
  const accountId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  const accountingEntityId =
    '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
  const correlationId = 'bank-details-correlation';
  const account = {
    id: accountId,
    accountingEntityId,
    behavior: 'bank',
    status: ELedgerAccountStatus.Active,
    meta: null,
  } as ILedgerAccount;
  const useCase = makeGetLedgerAccountOpeningBalanceUsecase({
    appContext: mockAppContext,
    ledgerAccountRepo: mockLedgerAccountRepo,
    journalEntryQueryRepo: mockJournalEntryQueryRepo,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      correlationId,
      accountingEntity: { id: accountingEntityId } as IAccountingEntity,
    } as ReturnType<typeof mockAppContext.get>);
    mockLedgerAccountRepo.findById.mockResolvedValue(account);
    mockJournalEntryQueryRepo.findAll.mockResolvedValue({
      data: [],
      meta: { total: 0, totalPages: 0, limit: 1, page: 1 },
    });
  });

  it('returns null for no opening entry and queries within the accounting entity', async () => {
    await expect(useCase(accountId)).resolves.toEqual({ openingBalance: null });
    expect(mockLedgerAccountRepo.findById).toHaveBeenCalledWith(
      accountId,
      accountingEntityId,
      { correlationId }
    );
    expect(mockJournalEntryQueryRepo.findAll).toHaveBeenCalledWith(
      accountingEntityId,
      {
        correlationId,
        accountId,
        sourceType: 'opening_balance',
        limit: 1,
      }
    );
  });

  it('rejects an invalid ID before reading context or repositories', async () => {
    await expect(useCase('invalid-id' as TEntityId)).rejects.toThrow(
      ledgerAccountError.InvalidId
    );
    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
    expect(mockJournalEntryQueryRepo.findAll).not.toHaveBeenCalled();
  });

  it('rejects an account absent from the active accounting entity before reading bank details', async () => {
    mockLedgerAccountRepo.findById.mockResolvedValue(null);
    await expect(useCase(accountId)).rejects.toThrow(
      ledgerAppError.AccountNotFound
    );
    expect(mockJournalEntryQueryRepo.findAll).not.toHaveBeenCalled();
  });

  it('propagates repository failures', async () => {
    const failure = new ledgerAccountError.BankDetailsMissing();
    mockJournalEntryQueryRepo.findAll.mockRejectedValue(failure);
    await expect(useCase(accountId)).rejects.toBe(failure);
  });
});
