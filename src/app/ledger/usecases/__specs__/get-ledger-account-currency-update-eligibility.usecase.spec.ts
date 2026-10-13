import generateUUID from '@shared/utils/uuid-generator';

import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/contracts/app-context.contract';
import { mockLedgerAccountService } from '@app/ledger/contracts/__mocks__/ledger.domain.services.mock';
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import makeGetLedgerAccountCurrencyUpdateEligibilityUsecase from '@app/ledger/usecases/get-ledger-account-currency-update-eligibility.usecase';

const [header] = ledgerAccountEntity.make({
  code: '100000',
  materializedPath: '100000',
  accountingEntityId: generateUUID(),
  createdBy: generateUUID(),
  name: 'Cash control',
  type: 'asset',
  subType: 'cash_and_cash_equivalent',
  behavior: 'default_cash',
  normalBalance: 'debit',
  isControlAccount: true,
  controlAccountId: null,
  currency: null,
  status: 'active',
  meta: null,
  contraAccountRule: 'contra_permitted',
  adjunctAccountRule: 'adjunct_permitted',
});
const [account] = ledgerAccountEntity.make({
  ...header,
  code: '100001',
  materializedPath: '100000.100001',
  controlAccountId: header.id,
  status: 'draft',
});

const usecase = makeGetLedgerAccountCurrencyUpdateEligibilityUsecase({
  appContext: mockAppContext,
  ledgerAccountRepo: mockLedgerAccountRepo,
  ledgerAccountService: mockLedgerAccountService,
});

describe('get ledger account currency update eligibility use case', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      accountingEntity: { id: account.accountingEntityId },
      correlationId: 'eligibility',
    } as IAppContextData);
    mockLedgerAccountRepo.findById.mockResolvedValue(account);
    mockLedgerAccountService.canUpdateCurrency.mockResolvedValue({
      canUpdateCurrency: true,
    });
  });

  it.each<Awaited<ReturnType<typeof usecase>>>([
    { canUpdateCurrency: true },
    { canUpdateCurrency: false, reason: 'not_asset_account' },
    { canUpdateCurrency: false, reason: 'has_posted_journal_entries' },
  ])('returns the domain eligibility decision %p', async (eligibility) => {
    mockLedgerAccountService.canUpdateCurrency.mockResolvedValue(eligibility);
    await expect(usecase(account.id)).resolves.toEqual(eligibility);

    expect(mockAppContext.get).toHaveBeenCalledWith(['accountingEntity']);
    expect(mockLedgerAccountRepo.findById).toHaveBeenCalledWith(
      account.id,
      account.accountingEntityId,
      { correlationId: 'eligibility' }
    );
    expect(mockLedgerAccountService.canUpdateCurrency).toHaveBeenCalledWith(
      account,
      {
        correlationId: 'eligibility',
      }
    );
    expect(mockLedgerAccountService.delete).not.toHaveBeenCalled();
    expect(mockLedgerAccountRepo.delete).not.toHaveBeenCalled();
  });

  it('rejects an invalid ID before reading context or repositories', async () => {
    await expect(usecase('invalid')).rejects.toThrow(
      ledgerAccountError.InvalidId
    );

    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
    expect(mockLedgerAccountService.canUpdateCurrency).not.toHaveBeenCalled();
  });

  it('hides an absent or out-of-scope account without checking currency update', async () => {
    mockLedgerAccountRepo.findById.mockResolvedValue(null);

    await expect(usecase(account.id)).rejects.toThrow(
      ledgerAccountError.AccountNotFound
    );
    expect(mockLedgerAccountService.canUpdateCurrency).not.toHaveBeenCalled();
  });

  it('propagates account query failures without checking currency update', async () => {
    const failure = new Error('account query failed');
    mockLedgerAccountRepo.findById.mockRejectedValue(failure);

    await expect(usecase(account.id)).rejects.toBe(failure);
    expect(mockLedgerAccountService.canUpdateCurrency).not.toHaveBeenCalled();
  });

  it('propagates domain service failures', async () => {
    const failure = new Error('journal reference query failed');
    mockLedgerAccountService.canUpdateCurrency.mockRejectedValue(failure);

    await expect(usecase(account.id)).rejects.toBe(failure);
  });
});
