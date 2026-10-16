import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService, {
  mockRepoTransaction,
} from '@shared/contracts/__mocks__/repo.mock';
import generateUUID from '@shared/utils/uuid-generator';
import repoError from '@shared/values/errors/repo.error';

import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/contracts/app-context.contract';
import mockJournalEntryPersistenceAppService from '@app/journal-entry/contracts/__mocks__/journal-entry-persistence.service.mock';
import { mockLedgerAccountService } from '@app/ledger/contracts/__mocks__/ledger.domain.services.mock';
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import makeDeleteLedgerAccountUsecase from '@app/ledger/usecases/delete-ledger-account.usecase';

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
const [child] = ledgerAccountEntity.make({
  ...account,
  code: '100002',
  materializedPath: '100000.100001.100002',
  controlAccountId: account.id,
  isControlAccount: false,
});
const amount = moneyValue.make(100, SYSTEM_CURRENCIES.NGN, false);
const [draftEntry] = journalEntryEntity.make({
  accountingEntityId: account.accountingEntityId,
  sourceType: 'payment',
  effectiveDate: new Date('2026-01-01'),
  postedAt: null,
  memo: null,
  createdBy: account.createdBy,
  functionalCurrency: SYSTEM_CURRENCIES.NGN,
  lines: [
    {
      accountId: child.id,
      sequenceOrder: 1,
      amount,
      exchangeRate: null,
      side: 'debit',
      description: null,
      functionalCurrency: SYSTEM_CURRENCIES.NGN,
    },
    {
      accountId: generateUUID(),
      sequenceOrder: 2,
      amount,
      exchangeRate: null,
      side: 'credit',
      description: null,
      functionalCurrency: SYSTEM_CURRENCIES.NGN,
    },
  ],
});
const journalEntries = [
  { ...draftEntry, version: 4 },
  { ...draftEntry, id: generateUUID(), version: 2 },
];
const accountDeletions = [child, account].map(ledgerAccountEntity.delete);
const usecase = makeDeleteLedgerAccountUsecase({
  appContext: mockAppContext,
  ledgerAccountRepo: mockLedgerAccountRepo,
  ledgerAccountService: mockLedgerAccountService,
  journalEntryPersistenceAppService: mockJournalEntryPersistenceAppService,
  repoService: mockRepoService,
  eventBus: mockEventBus,
});

describe('delete ledger account use case', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      actor: { id: header.createdBy },
      accountingEntity: { id: header.accountingEntityId },
      correlationId: 'delete',
      idempotencyKey: 'delete-once',
    } as IAppContextData);
    mockLedgerAccountRepo.findById.mockResolvedValue(account);
    mockLedgerAccountService.delete.mockResolvedValue({
      accounts: accountDeletions,
      journalEntries,
    });
    mockRepoService.createTransaction.mockResolvedValue(mockRepoTransaction);
    mockRepoTransaction.handleError.mockImplementation(async (error) => {
      throw error;
    });
  });

  it('reads the target once in its entity and deletes journals before accounts in one transaction', async () => {
    await expect(usecase(account.id)).resolves.toBeUndefined();
    const readOptions = {
      correlationId: 'delete',
      tx: mockRepoTransaction.context,
      lock: 'update',
    };
    expect(mockLedgerAccountRepo.findById).toHaveBeenCalledTimes(1);
    expect(mockLedgerAccountRepo.findById).toHaveBeenCalledWith(
      account.id,
      account.accountingEntityId,
      readOptions
    );
    expect(mockLedgerAccountRepo.findByCode).not.toHaveBeenCalled();
    expect(mockLedgerAccountService.delete).toHaveBeenCalledWith(
      account,
      readOptions
    );
    const writeOptions = {
      correlationId: 'delete',
      tx: mockRepoTransaction.context,
    };
    expect(mockJournalEntryPersistenceAppService.delete).toHaveBeenCalledTimes(
      2
    );
    for (const entry of journalEntries) {
      expect(mockJournalEntryPersistenceAppService.delete).toHaveBeenCalledWith(
        { journalEntryId: entry.id, expectedVersion: entry.version },
        writeOptions
      );
    }
    expect(mockLedgerAccountRepo.delete).toHaveBeenNthCalledWith(1, child.id, {
      ...writeOptions,
      expectedVersion: child.version,
    });
    expect(mockLedgerAccountRepo.delete).toHaveBeenNthCalledWith(
      2,
      account.id,
      { ...writeOptions, expectedVersion: account.version }
    );
    expect(
      mockJournalEntryPersistenceAppService.delete.mock.invocationCallOrder[1]
    ).toBeLessThan(mockLedgerAccountRepo.delete.mock.invocationCallOrder[0]);
    expect(
      mockLedgerAccountRepo.delete.mock.invocationCallOrder[1]
    ).toBeLessThan(mockRepoTransaction.commit.mock.invocationCallOrder[0]);
    expect(mockRepoTransaction.commit).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      accountDeletions.map(([, event]) =>
        expect.objectContaining({
          ...event,
          correlationId: 'delete',
          idempotencyKey: 'delete-once',
          enrichedAt: expect.any(Date),
        })
      )
    );
    expect(mockEventBus.publish.mock.invocationCallOrder[0]).toBeGreaterThan(
      mockRepoTransaction.commit.mock.invocationCallOrder[0]
    );
    expect(mockRepoTransaction.dispose).not.toHaveBeenCalled();
  });

  it('deletes an account with no associated journals', async () => {
    mockLedgerAccountService.delete.mockResolvedValue({
      accounts: [ledgerAccountEntity.delete(account)],
      journalEntries: [],
    });
    await usecase(account.id);
    expect(mockJournalEntryPersistenceAppService.delete).not.toHaveBeenCalled();
    expect(mockLedgerAccountRepo.delete).toHaveBeenCalledTimes(1);
    expect(mockRepoTransaction.commit).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'domain:ledger:account:deleted',
        data: account,
      }),
    ]);
  });

  it('validates IDs before reading request context', async () => {
    await expect(usecase('invalid')).rejects.toBeInstanceOf(
      ledgerAccountError.InvalidId
    );
    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('rejects a missing or other-entity account and delegates transaction cleanup', async () => {
    mockLedgerAccountRepo.findById.mockResolvedValue(null);
    await expect(usecase(account.id)).rejects.toBeInstanceOf(
      ledgerAccountError.AccountNotFound
    );
    expect(mockLedgerAccountService.delete).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    expect(mockLedgerAccountRepo.delete).not.toHaveBeenCalled();
    expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
    expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(
      expect.any(ledgerAccountError.AccountNotFound)
    );
    expect(mockRepoTransaction.dispose).not.toHaveBeenCalled();
  });

  it('does not persist when the domain rejects deletion', async () => {
    const error = new ledgerAccountError.InvalidDraftAccountJournalEntry();
    mockLedgerAccountService.delete.mockRejectedValue(error);
    await expect(usecase(account.id)).rejects.toBe(error);
    expect(mockJournalEntryPersistenceAppService.delete).not.toHaveBeenCalled();
    expect(mockLedgerAccountRepo.delete).not.toHaveBeenCalled();
    expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
    expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(error);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it.each(['journal', 'account', 'foreign key', 'commit'])(
    'delegates cleanup to handleError after a %s failure',
    async (stage) => {
      const error =
        stage === 'foreign key'
          ? Object.assign(new Error('foreign key violation'), { code: '23503' })
          : new repoError.VersionNotFound();
      if (stage === 'journal') {
        mockJournalEntryPersistenceAppService.delete
          .mockResolvedValueOnce()
          .mockRejectedValueOnce(error);
      }
      const isAccountFailure = stage === 'account' || stage === 'foreign key';
      if (isAccountFailure) {
        mockLedgerAccountRepo.delete
          .mockResolvedValueOnce()
          .mockRejectedValueOnce(error);
      }
      if (stage === 'commit') {
        mockRepoTransaction.commit.mockRejectedValueOnce(error);
      }
      await expect(usecase(account.id)).rejects.toBe(error);
      expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(error);
      expect(mockEventBus.publish).not.toHaveBeenCalled();
      expect(mockRepoTransaction.dispose).not.toHaveBeenCalled();
      if (stage !== 'commit') {
        expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
      }
      if (stage === 'journal') {
        expect(mockLedgerAccountRepo.delete).not.toHaveBeenCalled();
      }
    }
  );

  it('waits for commit completion before publishing any account deletion events', async () => {
    let release!: () => void;
    let started!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    mockRepoTransaction.commit.mockImplementation(async () => {
      started();
      await blocked;
    });

    const request = usecase(account.id);
    try {
      await ready;
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    } finally {
      release();
      await request;
    }
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
  });

  it('propagates publication failures after committing the deletions', async () => {
    const failure = new Error('publication failed');
    mockEventBus.publish.mockRejectedValue(failure);

    await expect(usecase(account.id)).rejects.toBe(failure);

    expect(mockRepoTransaction.commit).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish.mock.invocationCallOrder[0]).toBeGreaterThan(
      mockRepoTransaction.commit.mock.invocationCallOrder[0]
    );
    expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(failure);
  });
});
