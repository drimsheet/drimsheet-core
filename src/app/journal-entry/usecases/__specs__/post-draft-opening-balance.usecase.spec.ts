import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService, {
  mockRepoTransaction,
} from '@shared/contracts/__mocks__/repo.mock';
import { ERepoLock } from '@shared/types/repo.types';
import generateUUID from '@shared/utils/uuid-generator';
import appError from '@shared/values/errors/app.error';
import repoError from '@shared/values/errors/repo.error';
import eventValue from '@shared/values/events/event.vo';

import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import makeJournalEntryService from '@domain/journal-entry/services/journal-entry.service';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

import { mockAccountingPeriodService } from '@app/accounting/contracts/__mocks__/accounting.domain.services.mock';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/types/app-context.types';
import mockJournalEntryPersistenceAppService from '@app/journal-entry/contracts/__mocks__/journal-entry-persistence.service.mock';
import { mockJournalEntryService } from '@app/journal-entry/contracts/__mocks__/journal-entry.domain.services.mock';
import { mockJournalEntryRepo } from '@app/journal-entry/contracts/__mocks__/journal-entry.repos.mock';
import makePostDraftOpeningBalanceUsecase from '@app/journal-entry/usecases/post-draft-opening-balance.usecase';
import mockLedgerAccountBalanceAdjustmentQueue from '@app/ledger/contracts/__mocks__/ledger-balance-adjustment-queue.mock';
import {
  mockLedgerAccountBalanceRepo,
  mockLedgerAccountRepo,
} from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import mockOutboxAppService from '@app/outbox/contracts/__mocks__/outbox.service.mock';
import mockFxLotCostBasisAppService from '@app/subledger/fx-cost-basis/contracts/__mocks__/fx-cost-basis-persistence.service.mock';
import mockFxLotAppService from '@app/subledger/fx-cost-basis/contracts/__mocks__/fx-lot.service.mock';
import { TFxLotAcquisitionAppResult } from '@app/subledger/fx-cost-basis/types/fx-lot.service.types';

const actorId = generateUUID();
const effectiveDate = new Date('2026-03-01T00:00:00.000Z');
const [account] = ledgerAccountEntity.make({
  code: '100001',
  materializedPath: '100000.100001',
  accountingEntityId: generateUUID(),
  createdBy: actorId,
  name: 'Petty cash',
  type: 'asset',
  subType: 'cash_and_cash_equivalent',
  behavior: 'petty_cash',
  normalBalance: 'debit',
  isControlAccount: false,
  controlAccountId: generateUUID(),
  currency: SYSTEM_CURRENCIES.NGN,
  status: 'active',
  meta: null,
  openingBalanceDate: effectiveDate,
  contraAccountRule: 'contra_permitted',
  adjunctAccountRule: 'adjunct_permitted',
});
const [equityAccount] = ledgerAccountEntity.make({
  ...account,
  code: '300001',
  materializedPath: '300000.300001',
  name: 'Opening balance equity',
  type: 'equity',
  subType: 'opening_balance',
  behavior: 'opening_balance_equity',
  normalBalance: 'credit',
  openingBalanceDate: null,
});
const [originalEntry] = journalEntryEntity.make({
  accountingEntityId: account.accountingEntityId,
  createdBy: actorId,
  sourceType: 'opening_balance',
  memo: 'Opening balance',
  effectiveDate,
  postedAt: null,
  functionalCurrency: SYSTEM_CURRENCIES.NGN,
  lines: [
    {
      accountId: account.id,
      sequenceOrder: 1,
      side: 'debit',
      amount: { amount: 10000n, currency: SYSTEM_CURRENCIES.NGN },
      exchangeRate: null,
      description: 'Opening balance',
      functionalCurrency: SYSTEM_CURRENCIES.NGN,
    },
    {
      accountId: equityAccount.id,
      sequenceOrder: 2,
      side: 'credit',
      amount: { amount: 10000n, currency: SYSTEM_CURRENCIES.NGN },
      exchangeRate: null,
      description: null,
      functionalCurrency: SYSTEM_CURRENCIES.NGN,
    },
  ],
});
const posting = journalEntryEntity.update(
  originalEntry,
  { id: originalEntry.id, status: 'posted', postedAt: new Date() },
  actorId
);
const repoOptions = { correlationId: 'post-opening' };
const transactionOptions = { ...repoOptions, tx: mockRepoTransaction.context };
const lockedReadOptions = { ...transactionOptions, lock: ERepoLock.Share };
const usecase = makePostDraftOpeningBalanceUsecase({
  appContext: mockAppContext,
  ledgerAccountRepo: mockLedgerAccountRepo,
  journalEntryRepo: mockJournalEntryRepo,
  journalEntryService: mockJournalEntryService,
  journalEntryPersistenceAppService: mockJournalEntryPersistenceAppService,
  fxLotAppService: mockFxLotAppService,
  fxCostBasisPersistenceAppService: mockFxLotCostBasisAppService.persistence,
  outboxAppService: mockOutboxAppService,
  ledgerBalanceAdjustmentQueue: mockLedgerAccountBalanceAdjustmentQueue,
  repoService: mockRepoService,
  eventBus: mockEventBus,
});

describe('post draft opening balance use case', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      actor: { id: actorId },
      accountingEntity: { id: account.accountingEntityId },
      ...repoOptions,
      idempotencyKey: 'request',
    } as IAppContextData);
    mockLedgerAccountRepo.findAllByIds.mockResolvedValue([
      account,
      equityAccount,
    ]);
    mockJournalEntryRepo.findById.mockResolvedValue(originalEntry);
    mockJournalEntryService.postDraftOpeningBalance.mockResolvedValue(posting);
    mockFxLotAppService.acquire.mockResolvedValue(null);
    mockRepoService.createTransaction.mockResolvedValue(mockRepoTransaction);
    mockRepoTransaction.handleError.mockImplementation(async (error) => {
      throw error;
    });
  });

  it.each([false, true])(
    'posts only the draft opening journal atomically, FX=%s',
    async (hasFx) => {
      const fxRecords = {} as TFxLotAcquisitionAppResult['records'];
      const fxEvent = eventValue.make({
        type: 'domain:fx:acquisition:created',
        data: { id: generateUUID() },
      });
      if (hasFx) {
        mockFxLotAppService.acquire.mockResolvedValue({
          records: fxRecords,
          events: [fxEvent],
        });
      }

      await expect(usecase(originalEntry.id)).resolves.toBeUndefined();

      expect(mockLedgerAccountRepo.findAllByIds).toHaveBeenCalledWith(
        [account.id, equityAccount.id],
        lockedReadOptions
      );
      expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
      expect(mockJournalEntryRepo.findById).toHaveBeenCalledWith(
        originalEntry.id,
        repoOptions
      );
      expect(
        mockJournalEntryService.postDraftOpeningBalance
      ).toHaveBeenCalledWith(
        { entry: originalEntry, account, actor: actorId },
        transactionOptions
      );
      expect(mockFxLotAppService.acquire).toHaveBeenCalledWith(
        { journalEntry: posting[0], account, actor: actorId },
        transactionOptions
      );
      expect(
        mockRepoService.createTransaction.mock.invocationCallOrder[0]
      ).toBeLessThan(
        mockLedgerAccountRepo.findAllByIds.mock.invocationCallOrder[0]
      );
      expect(
        mockLedgerAccountRepo.findAllByIds.mock.invocationCallOrder[0]
      ).toBeLessThan(
        mockJournalEntryService.postDraftOpeningBalance.mock
          .invocationCallOrder[0]
      );
      expect(
        mockFxLotAppService.acquire.mock.invocationCallOrder[0]
      ).toBeLessThan(
        mockJournalEntryPersistenceAppService.rectify.mock
          .invocationCallOrder[0]
      );
      expect(
        mockJournalEntryPersistenceAppService.rectify
      ).toHaveBeenCalledWith(
        {
          entriesToCreate: [],
          entryUpdate: {
            entry: posting[0],
            expectedVersion: originalEntry.version,
            headerHistory: expect.objectContaining({
              entityId: originalEntry.id,
              entityVersion: posting[0].version,
              actorId,
              ...repoOptions,
            }),
            lineHistories: [],
            linesToCreate: [],
            linesToUpdate: [],
            lineIdsToDelete: [],
          },
        },
        transactionOptions
      );
      if (hasFx) {
        expect(
          mockFxLotCostBasisAppService.persistence.persistAcquisition
        ).toHaveBeenCalledWith(fxRecords, transactionOptions);
      } else {
        expect(
          mockFxLotCostBasisAppService.persistence.persistAcquisition
        ).not.toHaveBeenCalled();
      }
      expect(
        mockOutboxAppService.createBalancePropagation
      ).toHaveBeenCalledWith(originalEntry.id, transactionOptions);
      expect(
        mockOutboxAppService.createBalancePropagation.mock
          .invocationCallOrder[0]
      ).toBeLessThan(mockRepoTransaction.commit.mock.invocationCallOrder[0]);
      expect(
        mockRepoTransaction.commit.mock.invocationCallOrder[0]
      ).toBeLessThan(mockEventBus.publish.mock.invocationCallOrder[0]);
      expect(mockEventBus.publish.mock.invocationCallOrder[0]).toBeLessThan(
        mockLedgerAccountBalanceAdjustmentQueue.add.mock.invocationCallOrder[0]
      );
      expect(mockLedgerAccountBalanceAdjustmentQueue.add).toHaveBeenCalledWith({
        journalEntryId: originalEntry.id,
        ...repoOptions,
      });
      expect(mockEventBus.publish).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'domain:journal-entry:updated',
          data: posting[0],
          ...repoOptions,
          idempotencyKey: 'request',
        }),
        ...(hasFx
          ? [
              expect.objectContaining({
                type: fxEvent.type,
                data: fxEvent.data,
                ...repoOptions,
                idempotencyKey: 'request',
              }),
            ]
          : []),
      ]);
      expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
      expect(account.status).toBe('active');
      expect(mockRepoTransaction.dispose).not.toHaveBeenCalled();
    }
  );

  it('rejects an invalid journal ID before reading context', async () => {
    await expect(usecase('invalid')).rejects.toBeInstanceOf(
      journalEntryError.InvalidJournalEntry
    );
    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockLedgerAccountRepo.findAllByIds).not.toHaveBeenCalled();
  });

  it('rolls back when the locked account read cannot find the opening account', async () => {
    mockLedgerAccountRepo.findAllByIds.mockResolvedValue([equityAccount]);
    await expect(usecase(originalEntry.id)).rejects.toBeInstanceOf(
      journalEntryError.AccountNotFound
    );
    expect(
      mockJournalEntryService.postDraftOpeningBalance
    ).not.toHaveBeenCalled();
    expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(
      expect.any(journalEntryError.AccountNotFound)
    );
    expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
  });

  it.each([null, { ...originalEntry, accountingEntityId: generateUUID() }])(
    'rejects missing or out-of-entity journal entries before account lookup',
    async (entry) => {
      mockJournalEntryRepo.findById.mockResolvedValue(entry);
      await expect(usecase(originalEntry.id)).rejects.toBeInstanceOf(
        appError.ResourceNotFound
      );
      expect(mockLedgerAccountRepo.findAllByIds).not.toHaveBeenCalled();
      expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
    }
  );

  it.each([
    { ...originalEntry, status: 'posted' as const },
    { ...originalEntry, sourceType: 'receipt' as const },
  ])(
    'delegates posting eligibility to the domain and propagates its rejection',
    async (entry) => {
      const failure = new journalEntryError.RectificationNotPermitted();
      mockJournalEntryRepo.findById.mockResolvedValue(entry);
      mockJournalEntryService.postDraftOpeningBalance.mockRejectedValue(
        failure
      );

      await expect(usecase(entry.id)).rejects.toBe(failure);

      expect(
        mockJournalEntryService.postDraftOpeningBalance
      ).toHaveBeenCalledWith(
        { entry, account, actor: actorId },
        transactionOptions
      );
      expect(mockFxLotAppService.acquire).not.toHaveBeenCalled();
      expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(failure);
      expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
      expect(
        mockJournalEntryPersistenceAppService.rectify
      ).not.toHaveBeenCalled();
    }
  );

  it.each([
    { accountSequence: 2, equitySequence: 1 },
    { accountSequence: 10, equitySequence: 20 },
  ])(
    'selects the non-equity account independently of journal and repository order: %j',
    async ({ accountSequence, equitySequence }) => {
      const reorderedEntry = {
        ...originalEntry,
        lines: originalEntry.lines
          .map((line) => ({
            ...line,
            sequenceOrder:
              line.accountId === account.id ? accountSequence : equitySequence,
          }))
          .reverse(),
      };
      mockJournalEntryRepo.findById.mockResolvedValue(reorderedEntry);
      mockLedgerAccountRepo.findAllByIds.mockResolvedValue([
        equityAccount,
        account,
      ]);

      await usecase(originalEntry.id);

      expect(mockLedgerAccountRepo.findAllByIds).toHaveBeenCalledWith(
        [equityAccount.id, account.id],
        lockedReadOptions
      );
      expect(
        mockJournalEntryService.postDraftOpeningBalance
      ).toHaveBeenCalledWith(
        { entry: reorderedEntry, account, actor: actorId },
        transactionOptions
      );
      expect(mockFxLotAppService.acquire).toHaveBeenCalledWith(
        { journalEntry: posting[0], account, actor: actorId },
        transactionOptions
      );
    }
  );

  it.each(['draft', 'archived'] as const)(
    'propagates domain rejection of a %s account without changing its status',
    async (status) => {
      const unpostableAccount = { ...account, status };
      mockLedgerAccountRepo.findAllByIds.mockResolvedValue([
        unpostableAccount,
        equityAccount,
      ]);
      const failure =
        status === 'draft'
          ? new journalEntryError.DraftLedgerAccountNotAllowed()
          : new journalEntryError.ArchivedLedgerAccountNotAllowed();
      mockJournalEntryService.postDraftOpeningBalance.mockRejectedValue(
        failure
      );
      await expect(usecase(originalEntry.id)).rejects.toBe(failure);
      expect(
        mockJournalEntryService.postDraftOpeningBalance
      ).toHaveBeenCalledWith(
        { entry: originalEntry, account: unpostableAccount, actor: actorId },
        transactionOptions
      );
      expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
      expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(failure);
      expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
    }
  );

  it.each(['account lookup', 'journal lookup', 'posting', 'FX'])(
    'propagates %s preparation failures before writes',
    async (phase) => {
      const failure = new journalEntryError.RectificationNotPermitted();
      if (phase === 'account lookup') {
        mockLedgerAccountRepo.findAllByIds.mockRejectedValue(failure);
      }
      if (phase === 'journal lookup') {
        mockJournalEntryRepo.findById.mockRejectedValue(failure);
      }
      if (phase === 'posting') {
        mockJournalEntryService.postDraftOpeningBalance.mockRejectedValue(
          failure
        );
      }
      if (phase === 'FX') {
        mockFxLotAppService.acquire.mockRejectedValue(failure);
      }
      await expect(usecase(originalEntry.id)).rejects.toBe(failure);
      if (phase === 'journal lookup') {
        expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
        expect(mockRepoTransaction.handleError).not.toHaveBeenCalled();
      } else {
        expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(failure);
        expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
      }
      expect(
        mockJournalEntryPersistenceAppService.rectify
      ).not.toHaveBeenCalled();
      expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    }
  );

  it.each([account, equityAccount])(
    'rejects when archival of $name commits before posting acquires its account locks',
    async (archivalTarget) => {
      const [archivedAccount] = ledgerAccountEntity.archive(archivalTarget);
      let currentAccounts = [account, equityAccount];
      mockRepoService.createTransaction.mockImplementation(async () => {
        currentAccounts = currentAccounts.map((candidate) =>
          candidate.id === archivalTarget.id ? archivedAccount : candidate
        );
        return mockRepoTransaction;
      });
      mockLedgerAccountRepo.findAllByIds.mockImplementation(async (ids) =>
        currentAccounts.filter((candidate) => ids.includes(candidate.id))
      );
      const domainService = makeJournalEntryService({
        ledgerAccountRepo: mockLedgerAccountRepo,
        accountingPeriodService: mockAccountingPeriodService,
        ledgerAccountBalanceRepo: mockLedgerAccountBalanceRepo,
      });
      mockJournalEntryService.postDraftOpeningBalance.mockImplementation(
        domainService.postDraftOpeningBalance
      );

      await expect(usecase(originalEntry.id)).rejects.toBeInstanceOf(
        journalEntryError.ArchivedLedgerAccountNotAllowed
      );

      expect(mockLedgerAccountRepo.findAllByIds).toHaveBeenNthCalledWith(
        1,
        [account.id, equityAccount.id],
        lockedReadOptions
      );
      expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(
        expect.any(journalEntryError.ArchivedLedgerAccountNotAllowed)
      );
      expect(
        mockJournalEntryPersistenceAppService.rectify
      ).not.toHaveBeenCalled();
      expect(mockFxLotAppService.acquire).not.toHaveBeenCalled();
      expect(
        mockOutboxAppService.createBalancePropagation
      ).not.toHaveBeenCalled();
      expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
      expect(
        mockLedgerAccountBalanceAdjustmentQueue.add
      ).not.toHaveBeenCalled();
    }
  );

  it.each([account, equityAccount])(
    'holds the lock on $name through posting commit before concurrent archival can complete',
    async (archivalTarget) => {
      const [archivedAccount] = ledgerAccountEntity.archive(archivalTarget);
      let currentAccount = archivalTarget;
      const heldAccountLocks = new Set<string>();
      let releaseAccountLocks: (() => void) | undefined;
      const accountLocksReleased = new Promise<void>((resolve) => {
        releaseAccountLocks = resolve;
      });
      const commits: string[] = [];
      let archival: Promise<void> | undefined;

      // In-process account-store fake: a Share lock blocks the archival write until commit.
      mockLedgerAccountRepo.findAllByIds.mockImplementation(
        async (ids, options) => {
          const holdsTransactionShareLock =
            options.tx === mockRepoTransaction.context &&
            options.lock === ERepoLock.Share;
          if (holdsTransactionShareLock) {
            for (const accountId of ids) {
              heldAccountLocks.add(accountId);
            }
          }
          return [account, equityAccount];
        }
      );
      const archiveAccount = async () => {
        if (heldAccountLocks.has(archivalTarget.id)) {
          await accountLocksReleased;
        }
        currentAccount = archivedAccount;
        commits.push('archival');
      };
      mockJournalEntryService.postDraftOpeningBalance.mockImplementation(
        async () => {
          archival = archiveAccount();
          await Promise.resolve();
          expect(currentAccount.status).toBe('active');
          return posting;
        }
      );
      mockRepoTransaction.commit.mockImplementation(async () => {
        expect(currentAccount.status).toBe('active');
        expect(heldAccountLocks).toEqual(
          new Set([account.id, equityAccount.id])
        );
        commits.push('posting');
        heldAccountLocks.clear();
        releaseAccountLocks?.();
      });

      await usecase(originalEntry.id);
      expect(archival).toBeDefined();
      await archival;

      expect(commits).toEqual(['posting', 'archival']);
      expect(currentAccount.status).toBe('archived');
      expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
      expect(mockRepoTransaction.handleError).not.toHaveBeenCalled();
    }
  );

  it.each(['journal', 'FX', 'outbox', 'commit'])(
    'handles %s persistence failure without publication or queueing',
    async (phase) => {
      const failure = new repoError.VersionNotFound();
      mockFxLotAppService.acquire.mockResolvedValue({
        records: {} as TFxLotAcquisitionAppResult['records'],
        events: [],
      });
      if (phase === 'journal') {
        mockJournalEntryPersistenceAppService.rectify.mockRejectedValue(
          failure
        );
      }
      if (phase === 'FX') {
        mockFxLotCostBasisAppService.persistence.persistAcquisition.mockRejectedValue(
          failure
        );
      }
      if (phase === 'outbox') {
        mockOutboxAppService.createBalancePropagation.mockRejectedValue(
          failure
        );
      }
      if (phase === 'commit') {
        mockRepoTransaction.commit.mockRejectedValue(failure);
      }
      await expect(usecase(originalEntry.id)).rejects.toBe(failure);
      expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(failure);
      expect(mockEventBus.publish).not.toHaveBeenCalled();
      expect(
        mockLedgerAccountBalanceAdjustmentQueue.add
      ).not.toHaveBeenCalled();
      expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
      expect(mockRepoTransaction.dispose).not.toHaveBeenCalled();
    }
  );
});
