import mockRepoService, {
  mockRepoTransaction,
} from '@shared/contracts/__mocks__/repo.mock';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import {
  EJournalEntryStatus,
  IJournalEntry,
} from '@domain/journal-entry/types/journal-entry.types';
import { EJournalSide } from '@domain/journal-entry/types/journal-line.types';
import ledgerAccountBalanceEntity from '@domain/ledger/entities/ledger-account-balance.entity';
import ledgerAccountBalanceAdjustmentService from '@domain/ledger/services/ledger-account-balance-adjustment.service';
import {
  ELedgerAccountStatus,
  ILedgerAccount,
} from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { mockJournalEntryRepo } from '@app/journal-entry/contracts/__mocks__/journal-entry.repos.mock';
import {
  mockLedgerAccountBalanceRepo,
  mockLedgerAccountRepo,
} from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import makeAdjustLedgerAccountBalanceUseCase from '@app/ledger/usecases/adjust-ledger-account-balance.usecase';

describe('makeAdjustLedgerAccountBalanceUseCase', () => {
  const accountingEntityId = generateUUID();
  const creatorId = generateUUID();
  const journalEntryId = generateUUID();
  const correlationId = generateUUID();
  const parentAccountId = '123e4567-e89b-12d3-a456-426614174003' as TEntityId;
  const childAccountId = '123e4567-e89b-12d3-a456-426614174004' as TEntityId;
  const payload = { journalEntryId };
  const readOptions = { correlationId };
  const writeOptions = { correlationId, tx: mockRepoTransaction.context };

  const childAccount = {
    createdBy: creatorId,
    id: childAccountId,
    accountingEntityId,
    materializedPath: '100000.100001',
    currency: SYSTEM_CURRENCIES.USD,
    type: 'asset',
    normalBalance: 'debit',
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
    functionalAmount: { amount: 150_000n, currency: SYSTEM_CURRENCIES.NGN },
  };
  const journalEntry = {
    id: journalEntryId,
    accountingEntityId,
    status: EJournalEntryStatus.Posted,
    postedAt: new Date('2026-09-22T00:00:00.000Z'),
    createdBy: creatorId,
    lines: [journalLine, journalLine],
  } as IJournalEntry;
  const makeBalance = (account: ILedgerAccount) =>
    ledgerAccountBalanceEntity.make({
      createdBy: creatorId,
      ledgerAccountId: account.id,
      accountingEntityId,
      accountMaterializedPath: account.materializedPath,
      currencyCode: account.currency?.code ?? SYSTEM_CURRENCIES.NGN.code,
      functionalCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
    });
  const childBalance = makeBalance(childAccount);
  const parentBalance = makeBalance(parentAccount);

  const adjustLedgerAccountBalance = makeAdjustLedgerAccountBalanceUseCase({
    appContext: mockAppContext,
    repoService: mockRepoService,
    journalEntryRepo: mockJournalEntryRepo,
    ledgerAccountRepo: mockLedgerAccountRepo,
    ledgerAccountBalanceRepo: mockLedgerAccountBalanceRepo,
    ledgerAccountBalanceAdjustmentService,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({ correlationId, idempotencyKey: '' });
    mockRepoService.createTransaction.mockResolvedValue(mockRepoTransaction);
    mockRepoTransaction.handleError.mockImplementation(async (error) => {
      throw error;
    });
    mockJournalEntryRepo.findById.mockResolvedValue(journalEntry);
    mockLedgerAccountRepo.findAllByIds.mockResolvedValue([childAccount]);
    mockLedgerAccountRepo.findAllByMaterializedPath.mockResolvedValue([
      parentAccount,
      childAccount,
    ]);
    mockLedgerAccountBalanceRepo.findAllByAccountIds.mockResolvedValue([
      childBalance,
      parentBalance,
    ]);
  });

  it('commits ordered, versioned balance writes in one transaction', async () => {
    await adjustLedgerAccountBalance(payload);

    expect(mockJournalEntryRepo.findById).toHaveBeenCalledWith(
      journalEntryId,
      readOptions
    );
    expect(mockLedgerAccountRepo.findAllByIds).toHaveBeenCalledWith(
      [childAccountId],
      accountingEntityId,
      readOptions
    );
    expect(
      mockLedgerAccountRepo.findAllByMaterializedPath
    ).toHaveBeenCalledWith(
      accountingEntityId,
      ['100000', '100000.100001'],
      readOptions
    );
    expect(
      mockLedgerAccountBalanceRepo.findAllByAccountIds
    ).toHaveBeenCalledWith(
      accountingEntityId,
      [parentAccountId, childAccountId],
      readOptions
    );
    const writes = mockLedgerAccountBalanceRepo.adjustBalance.mock.calls;
    expect(writes).toHaveLength(2);
    expect(writes[0]).toMatchObject([
      {
        newBalance: {
          ledgerAccountId: parentAccountId,
          amount: { amount: 300_000n },
        },
        adjustment: {
          ledgerAccountId: parentAccountId,
          journalEntryId,
          createdBy: creatorId,
        },
      },
      { ...writeOptions, expectedVersion: parentBalance.version },
    ]);
    expect(writes[1]).toMatchObject([
      {
        newBalance: {
          ledgerAccountId: childAccountId,
          amount: { amount: 200n },
          functionalAmount: { amount: 300_000n },
        },
      },
      { ...writeOptions, expectedVersion: childBalance.version },
    ]);

    expect(
      mockLedgerAccountBalanceRepo.findAllByAccountIds.mock
        .invocationCallOrder[0]
    ).toBeLessThan(
      mockRepoService.createTransaction.mock.invocationCallOrder[0]
    );
    expect(
      mockLedgerAccountBalanceRepo.adjustBalance.mock.invocationCallOrder[1]
    ).toBeLessThan(mockRepoTransaction.commit.mock.invocationCallOrder[0]);
  });

  it('uses app context when a payload contains correlation metadata', async () => {
    const existingPayload = {
      ...payload,
      correlationId: 'payload-correlation',
    };

    await adjustLedgerAccountBalance(existingPayload);

    expect(mockJournalEntryRepo.findById).toHaveBeenCalledWith(
      journalEntryId,
      readOptions
    );
  });

  it('skips the transaction when balances are unchanged', async () => {
    mockJournalEntryRepo.findById.mockResolvedValueOnce({
      ...journalEntry,
      lines: [
        ...journalEntry.lines,
        ...journalEntry.lines.map((line) => ({
          ...line,
          side: EJournalSide.Credit,
        })),
      ],
    });

    await adjustLedgerAccountBalance(payload);

    expect(mockLedgerAccountBalanceRepo.adjustBalance).not.toHaveBeenCalled();
    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
  });

  it('writes every account and ancestor when a journal exceeds 200 direct accounts', async () => {
    const directAccounts = Array.from({ length: 250 }, (_, index) => ({
      ...childAccount,
      id: generateUUID(),
      materializedPath: `100000.${100001 + index}`,
    }));
    const accounts = [parentAccount, ...directAccounts];
    mockJournalEntryRepo.findById.mockResolvedValueOnce({
      ...journalEntry,
      lines: directAccounts.map((account) => ({
        ...journalEntry.lines[0],
        accountId: account.id,
      })),
    });
    mockLedgerAccountRepo.findAllByIds.mockResolvedValueOnce(directAccounts);
    mockLedgerAccountRepo.findAllByMaterializedPath.mockResolvedValueOnce(
      accounts
    );
    mockLedgerAccountBalanceRepo.findAllByAccountIds.mockResolvedValueOnce(
      accounts.map(makeBalance)
    );

    await adjustLedgerAccountBalance(payload);

    expect(mockLedgerAccountRepo.findAllByIds).toHaveBeenCalledWith(
      directAccounts.map((account) => account.id),
      accountingEntityId,
      readOptions
    );
    expect(
      mockLedgerAccountRepo.findAllByMaterializedPath
    ).toHaveBeenCalledWith(
      accountingEntityId,
      accounts.map((account) => account.materializedPath),
      readOptions
    );
    expect(
      mockLedgerAccountBalanceRepo.adjustBalance.mock.calls.map(
        ([adjustment]) => adjustment.newBalance.ledgerAccountId
      )
    ).toEqual(accounts.map((account) => account.id).sort());
  });

  it('propagates an archived posting to archived accounts and ancestors', async () => {
    const archivedChild = {
      ...childAccount,
      status: ELedgerAccountStatus.Archived,
    };
    const archivedParent = {
      ...parentAccount,
      status: ELedgerAccountStatus.Archived,
    };
    mockJournalEntryRepo.findById.mockResolvedValueOnce({
      ...journalEntry,
      status: EJournalEntryStatus.Archived,
    });
    mockLedgerAccountRepo.findAllByIds.mockResolvedValueOnce([archivedChild]);
    mockLedgerAccountRepo.findAllByMaterializedPath.mockResolvedValueOnce([
      archivedParent,
      archivedChild,
    ]);

    await adjustLedgerAccountBalance(payload);

    expect(
      mockLedgerAccountBalanceRepo.adjustBalance.mock.calls.map(
        ([adjustment]) => adjustment.newBalance.ledgerAccountId
      )
    ).toEqual([parentAccountId, childAccountId]);
  });

  it.each<[string, IJournalEntry | null]>([
    ['unavailable', null],
    ['draft', { ...journalEntry, status: EJournalEntryStatus.Draft }],
    [
      'archived before posting',
      { ...journalEntry, status: EJournalEntryStatus.Archived, postedAt: null },
    ],
  ])(
    'rejects a journal that is %s before loading accounts',
    async (_, storedJournalEntry) => {
      mockJournalEntryRepo.findById.mockResolvedValueOnce(storedJournalEntry);

      await expect(adjustLedgerAccountBalance(payload)).rejects.toThrow(
        journalEntryError.InvalidJournalEntry
      );

      expect(mockLedgerAccountRepo.findAllByIds).not.toHaveBeenCalled();
      expect(
        mockLedgerAccountBalanceRepo.findAllByAccountIds
      ).not.toHaveBeenCalled();
      expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
    }
  );

  it.each([
    { scenario: 'fewer balance rows', balances: [childBalance] },
    {
      scenario: 'an unrelated balance row',
      balances: [
        childBalance,
        makeBalance({ ...parentAccount, id: generateUUID() }),
      ],
    },
  ])(
    'rejects a missing balance before writing with $scenario',
    async ({ balances }) => {
      mockLedgerAccountBalanceRepo.findAllByAccountIds.mockResolvedValueOnce(
        balances
      );

      await expect(adjustLedgerAccountBalance(payload)).rejects.toThrow(
        ledgerAppError.BalanceNotFound
      );
      expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
    }
  );

  it('rejects a hierarchy change between the account and balance reads', async () => {
    mockLedgerAccountBalanceRepo.findAllByAccountIds.mockResolvedValueOnce([
      parentBalance,
      {
        ...childBalance,
        accountMaterializedPath: '100000.100001.100002',
        version: childBalance.version + 1,
      },
    ]);

    await expect(adjustLedgerAccountBalance(payload)).rejects.toThrow(
      ledgerAppError.BalanceHierarchyChanged
    );
    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
  });

  it('propagates a preparation repository failure unchanged', async () => {
    const failure = new Error('balance repository unavailable');
    mockLedgerAccountBalanceRepo.findAllByAccountIds.mockRejectedValueOnce(
      failure
    );

    await expect(adjustLedgerAccountBalance(payload)).rejects.toBe(failure);
    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
  });

  it('handles an adjustment write failure without committing', async () => {
    const failure = new Error('write failed');
    mockLedgerAccountBalanceRepo.adjustBalance.mockRejectedValueOnce(failure);

    await expect(adjustLedgerAccountBalance(payload)).rejects.toBe(failure);
    expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(failure);
    expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
  });

  it('rejects an invalid journal trigger before reading the journal', async () => {
    await expect(
      adjustLedgerAccountBalance({ journalEntryId: 'invalid' as TEntityId })
    ).rejects.toThrow();

    expect(mockJournalEntryRepo.findById).not.toHaveBeenCalled();
    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
  });
});
