import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import {
  EJournalEntryStatus,
  IJournalEntry,
} from '@domain/journal-entry/types/journal-entry.types';
import { EJournalSide } from '@domain/journal-entry/types/journal-line.types';
import ledgerAccountBalanceEntity from '@domain/ledger/entities/ledger-account-balance.entity';
import { ILedgerAccountBalanceDelta } from '@domain/ledger/types/ledger-account-balance-adjustment.service.types';
import {
  ELedgerAccountStatus,
  ILedgerAccount,
} from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

import { mockJournalEntryRepo } from '@app/journal-entry/contracts/__mocks__/journal-entry.repos.mock';
import { mockLedgerAccountBalanceAdjustmentService } from '@app/ledger/contracts/__mocks__/ledger.domain.services.mock';
import {
  mockLedgerAccountBalanceRepo,
  mockLedgerAccountRepo,
} from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import makeLedgerBalancePropagationPreparationAppService from '@app/ledger/services/ledger-balance-propagation-preparation.service';

describe('makeLedgerBalancePropagationPreparationAppService', () => {
  const accountingEntityId =
    '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  const creatorId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
  const parentAccountId = '123e4567-e89b-12d3-a456-426614174003' as TEntityId;
  const childAccountId = '123e4567-e89b-12d3-a456-426614174004' as TEntityId;
  const unrelatedAccountId =
    '123e4567-e89b-12d3-a456-426614174005' as TEntityId;
  const journalEntryId = '123e4567-e89b-12d3-a456-426614174006' as TEntityId;
  const repoOptions: IReadRepoOptions = {
    correlationId: '123e4567-e89b-12d3-a456-426614174007',
  };

  const childAccount = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: childAccountId,
    accountingEntityId,
    materializedPath: '100000.100001',
    currency: SYSTEM_CURRENCIES.USD,
  } as ILedgerAccount;
  const parentAccount = {
    ...childAccount,
    id: parentAccountId,
    materializedPath: '100000',
    currency: SYSTEM_CURRENCIES.NGN,
  };
  const journalLine = {
    accountId: childAccountId,
    side: EJournalSide.Debit,
    amount: { amount: 100n, currency: SYSTEM_CURRENCIES.USD },
    functionalAmount: {
      amount: 150_000n,
      currency: SYSTEM_CURRENCIES.NGN,
    },
  };
  const journalEntry = {
    id: journalEntryId,
    accountingEntityId,
    status: EJournalEntryStatus.Posted,
    createdBy: creatorId,
    lines: [journalLine, journalLine],
  } as IJournalEntry;
  const childBalance = ledgerAccountBalanceEntity.make({
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    ledgerAccountId: childAccountId,
    accountingEntityId,
    accountMaterializedPath: childAccount.materializedPath,
    currencyCode: SYSTEM_CURRENCIES.USD.code,
    functionalCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
  });
  const parentBalance = ledgerAccountBalanceEntity.make({
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    ledgerAccountId: parentAccountId,
    accountingEntityId,
    accountMaterializedPath: parentAccount.materializedPath,
    currencyCode: SYSTEM_CURRENCIES.NGN.code,
    functionalCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
  });
  const deltas: ILedgerAccountBalanceDelta[] = [
    {
      ledgerAccountId: childAccountId,
      amount: { amount: 100n, currency: SYSTEM_CURRENCIES.USD },
      functionalAmount: {
        amount: 150_000n,
        currency: SYSTEM_CURRENCIES.NGN,
      },
    },
    {
      ledgerAccountId: parentAccountId,
      amount: { amount: 150_000n, currency: SYSTEM_CURRENCIES.NGN },
      functionalAmount: {
        amount: 150_000n,
        currency: SYSTEM_CURRENCIES.NGN,
      },
    },
  ];
  const page = (data: ILedgerAccount[]) => ({
    data,
    meta: { page: 1, limit: data.length, total: data.length, totalPages: 1 },
  });
  const service = makeLedgerBalancePropagationPreparationAppService({
    journalEntryRepo: mockJournalEntryRepo,
    ledgerAccountRepo: mockLedgerAccountRepo,
    ledgerAccountBalanceRepo: mockLedgerAccountBalanceRepo,
    ledgerAccountBalanceAdjustmentService:
      mockLedgerAccountBalanceAdjustmentService,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockJournalEntryRepo.findById.mockResolvedValue(journalEntry);
    mockLedgerAccountRepo.findAll.mockResolvedValue(page([childAccount]));
    mockLedgerAccountRepo.findAllByMaterializedPath.mockResolvedValue([
      parentAccount,
      childAccount,
    ]);
    mockLedgerAccountBalanceAdjustmentService.calculate.mockReturnValue(deltas);
    mockLedgerAccountBalanceRepo.findAllByAccountIds.mockResolvedValue([
      childBalance,
      parentBalance,
    ]);
  });

  it('prepares pending historical propagation for archived direct accounts and ancestors', async () => {
    const archivedChild = {
      ...childAccount,
      status: ELedgerAccountStatus.Archived,
    };
    const archivedParent = {
      ...parentAccount,
      status: ELedgerAccountStatus.Archived,
    };
    mockLedgerAccountRepo.findAll.mockResolvedValue(page([archivedChild]));
    mockLedgerAccountRepo.findAllByMaterializedPath.mockResolvedValue([
      archivedParent,
      archivedChild,
    ]);
    const adjustments = await service.prepare(journalEntryId, repoOptions);
    expect(mockLedgerAccountRepo.findAll).toHaveBeenCalledWith(
      accountingEntityId,
      { ...repoOptions, ids: [childAccountId], limit: 1 }
    );
    expect(
      mockLedgerAccountBalanceAdjustmentService.calculate
    ).toHaveBeenCalledWith(journalEntry, [archivedParent, archivedChild]);
    expect(
      adjustments.map(
        (change) => change.balanceAdjustment.newBalance.ledgerAccountId
      )
    ).toEqual([parentAccountId, childAccountId]);
  });
  it('prepares ordered versioned adjustments from the journal and account hierarchy', async () => {
    const preparedAdjustments = await service.prepare(
      journalEntryId,
      repoOptions
    );

    expect(mockJournalEntryRepo.findById).toHaveBeenCalledWith(
      journalEntryId,
      repoOptions
    );
    expect(mockLedgerAccountRepo.findAll).toHaveBeenCalledWith(
      accountingEntityId,
      {
        ...repoOptions,
        ids: [childAccountId],
        limit: 1,
      }
    );
    expect(
      mockLedgerAccountRepo.findAllByMaterializedPath
    ).toHaveBeenCalledWith(
      accountingEntityId,
      ['100000', '100000.100001'],
      repoOptions
    );
    expect(
      mockLedgerAccountBalanceAdjustmentService.calculate
    ).toHaveBeenCalledWith(journalEntry, [parentAccount, childAccount]);
    expect(
      mockLedgerAccountBalanceRepo.findAllByAccountIds
    ).toHaveBeenCalledWith(
      accountingEntityId,
      [parentAccountId, childAccountId],
      repoOptions
    );
    expect(
      preparedAdjustments.map(
        ({ balanceAdjustment }) => balanceAdjustment.newBalance.ledgerAccountId
      )
    ).toEqual([parentAccountId, childAccountId]);
    expect(
      preparedAdjustments.map(({ expectedVersion }) => expectedVersion)
    ).toEqual([parentBalance.version, childBalance.version]);
    expect(preparedAdjustments[0].balanceAdjustment.adjustment).toMatchObject({
      ledgerAccountId: parentAccountId,
      journalEntryId,
      createdBy: creatorId,
    });
    expect(mockLedgerAccountBalanceRepo.create).not.toHaveBeenCalled();
    expect(mockLedgerAccountBalanceRepo.adjustBalance).not.toHaveBeenCalled();
  });

  it('prepares an existing posting after the journal is archived', async () => {
    const archivedEntry = {
      ...journalEntry,
      status: EJournalEntryStatus.Archived,
      postedAt: new Date('2026-09-22T00:00:00.000Z'),
    };
    mockJournalEntryRepo.findById.mockResolvedValueOnce(archivedEntry);

    await expect(
      service.prepare(journalEntryId, repoOptions)
    ).resolves.toHaveLength(2);

    expect(
      mockLedgerAccountBalanceAdjustmentService.calculate
    ).toHaveBeenCalledWith(archivedEntry, [parentAccount, childAccount]);
  });

  it.each<[string, IJournalEntry | null]>([
    ['unavailable', null],
    ['not posted', { ...journalEntry, status: EJournalEntryStatus.Draft }],
    [
      'archived before posting',
      {
        ...journalEntry,
        status: EJournalEntryStatus.Archived,
        postedAt: null,
      },
    ],
  ])('rejects when the journal is %s', async (_, storedJournalEntry) => {
    mockJournalEntryRepo.findById.mockResolvedValueOnce(storedJournalEntry);

    await expect(service.prepare(journalEntryId, repoOptions)).rejects.toThrow(
      journalEntryError.InvalidJournalEntry
    );

    expect(mockLedgerAccountRepo.findAll).not.toHaveBeenCalled();
    expect(
      mockLedgerAccountBalanceRepo.findAllByAccountIds
    ).not.toHaveBeenCalled();
  });

  it('rejects when fewer balances than required are returned', async () => {
    mockLedgerAccountBalanceRepo.findAllByAccountIds.mockResolvedValueOnce([
      childBalance,
    ]);

    await expect(service.prepare(journalEntryId, repoOptions)).rejects.toThrow(
      ledgerAppError.BalanceNotFound
    );

    expect(mockLedgerAccountBalanceRepo.adjustBalance).not.toHaveBeenCalled();
  });

  it('rejects when a required balance is replaced by an unrelated row', async () => {
    const unrelatedBalance = ledgerAccountBalanceEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      ledgerAccountId: unrelatedAccountId,
      accountingEntityId,
      accountMaterializedPath: '100002',
      currencyCode: SYSTEM_CURRENCIES.NGN.code,
      functionalCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
    });
    mockLedgerAccountBalanceRepo.findAllByAccountIds.mockResolvedValueOnce([
      childBalance,
      unrelatedBalance,
    ]);

    await expect(service.prepare(journalEntryId, repoOptions)).rejects.toThrow(
      ledgerAppError.BalanceNotFound
    );

    expect(mockLedgerAccountBalanceRepo.adjustBalance).not.toHaveBeenCalled();
  });

  it('propagates unexpected repository failures unchanged', async () => {
    const failure = new Error('balance repository unavailable');
    mockLedgerAccountBalanceRepo.findAllByAccountIds.mockRejectedValueOnce(
      failure
    );

    await expect(service.prepare(journalEntryId, repoOptions)).rejects.toBe(
      failure
    );
    expect(mockLedgerAccountBalanceRepo.adjustBalance).not.toHaveBeenCalled();
  });
});
