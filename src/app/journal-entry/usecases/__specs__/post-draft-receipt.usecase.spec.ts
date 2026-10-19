import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService, {
  mockRepoTransaction,
} from '@shared/contracts/__mocks__/repo.mock';
import { ERepoLock } from '@shared/types/repo.types';
import generateUUID from '@shared/utils/uuid-generator';
import appError from '@shared/values/errors/app.error';
import repoError from '@shared/values/errors/repo.error';
import eventValue from '@shared/values/events/event.vo';

import counterpartyEntity from '@domain/counterparty/entities/counterparty.entity';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/types/app-context.types';
import { mockCounterpartyRepo } from '@app/counterparty/contracts/__mocks__/counterparty.repos.mock';
import mockJournalEntryPersistenceAppService from '@app/journal-entry/contracts/__mocks__/journal-entry-persistence.service.mock';
import { mockJournalEntryService } from '@app/journal-entry/contracts/__mocks__/journal-entry.domain.services.mock';
import { mockJournalEntryRepo } from '@app/journal-entry/contracts/__mocks__/journal-entry.repos.mock';
import makePostDraftReceiptUsecase from '@app/journal-entry/usecases/post-draft-receipt.usecase';
import mockLedgerAccountBalanceAdjustmentQueue from '@app/ledger/contracts/__mocks__/ledger-balance-adjustment-queue.mock';
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
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
const [revenueAccount] = ledgerAccountEntity.make({
  ...account,
  code: '300001',
  materializedPath: '300000.300001',
  name: 'Services',
  type: 'revenue',
  subType: 'services',
  behavior: 'services',
  normalBalance: 'credit',
  openingBalanceDate: null,
});
const [counterparty] = counterpartyEntity.make({
  accountingEntityId: account.accountingEntityId,
  createdBy: actorId,
  name: 'Customer',
  type: 'organization',
});
const [originalEntry] = journalEntryEntity.make({
  accountingEntityId: account.accountingEntityId,
  createdBy: actorId,
  sourceType: 'receipt',
  memo: 'Customer receipt',
  effectiveDate,
  postedAt: null,
  functionalCurrency: SYSTEM_CURRENCIES.NGN,
  lines: [
    {
      accountId: account.id,
      counterpartyId: counterparty.id,
      sequenceOrder: 1,
      side: 'debit',
      amount: { amount: 10000n, currency: SYSTEM_CURRENCIES.NGN },
      exchangeRate: null,
      description: 'Customer receipt',
      functionalCurrency: SYSTEM_CURRENCIES.NGN,
    },
    {
      accountId: revenueAccount.id,
      counterpartyId: counterparty.id,
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
const repoOptions = { correlationId: 'post-receipt' };
const transactionOptions = { ...repoOptions, tx: mockRepoTransaction.context };
const lockedReadOptions = { ...transactionOptions, lock: ERepoLock.Share };
const usecase = makePostDraftReceiptUsecase({
  appContext: mockAppContext,
  counterpartyRepo: mockCounterpartyRepo,
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

describe('post draft receipt use case', () => {
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
      revenueAccount,
    ]);
    mockJournalEntryRepo.findById.mockResolvedValue(originalEntry);
    mockJournalEntryService.postDraftReceipt.mockResolvedValue({
      journalEntry: posting,
      destinationAccount: account,
    });
    mockCounterpartyRepo.findById.mockResolvedValue(counterparty);
    mockFxLotAppService.acquire.mockResolvedValue(null);
    mockRepoService.createTransaction.mockResolvedValue(mockRepoTransaction);
    mockRepoTransaction.handleError.mockImplementation(async (error) => {
      throw error;
    });
  });

  it('commits without writes or downstream effects when posting returns no audit', async () => {
    mockJournalEntryRepo.findById.mockResolvedValue(posting[0]);
    mockJournalEntryService.postDraftReceipt.mockResolvedValue({
      journalEntry: [posting[0], [], null],
      destinationAccount: account,
    });

    await expect(usecase(posting[0].id)).resolves.toBeUndefined();

    expect(mockJournalEntryService.postDraftReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ entry: posting[0], actor: actorId }),
      transactionOptions
    );
    expect(mockRepoTransaction.commit).toHaveBeenCalledTimes(1);
    expect(mockRepoTransaction.handleError).not.toHaveBeenCalled();
    expect(mockRepoTransaction.dispose).not.toHaveBeenCalled();
    expect(
      mockJournalEntryPersistenceAppService.rectify
    ).not.toHaveBeenCalled();
    expect(mockFxLotAppService.acquire).not.toHaveBeenCalled();
    expect(mockFxLotAppService.dispose).not.toHaveBeenCalled();
    expect(
      mockFxLotCostBasisAppService.persistence.persistAcquisition
    ).not.toHaveBeenCalled();
    expect(
      mockFxLotCostBasisAppService.persistence.persistDisposition
    ).not.toHaveBeenCalled();
    expect(
      mockOutboxAppService.createBalancePropagation
    ).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'posts only the draft receipt journal atomically, FX=%s',
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
        [account.id, revenueAccount.id],
        lockedReadOptions
      );
      expect(mockCounterpartyRepo.findById).toHaveBeenCalledTimes(1);
      expect(mockCounterpartyRepo.findById).toHaveBeenCalledWith(
        counterparty.id,
        account.accountingEntityId,
        repoOptions
      );
      expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
      expect(mockJournalEntryRepo.findById).toHaveBeenCalledWith(
        originalEntry.id,
        repoOptions
      );
      expect(mockJournalEntryService.postDraftReceipt).toHaveBeenCalledWith(
        {
          entry: originalEntry,
          accounts: [account, revenueAccount],
          counterparties: [counterparty],
          actor: actorId,
        },
        transactionOptions
      );
      expect(mockFxLotAppService.acquire).toHaveBeenCalledWith(
        { journalEntry: posting[0], account, actor: actorId },
        repoOptions
      );
      expect(
        mockRepoService.createTransaction.mock.invocationCallOrder[0]
      ).toBeLessThan(
        mockLedgerAccountRepo.findAllByIds.mock.invocationCallOrder[0]
      );
      expect(
        mockLedgerAccountRepo.findAllByIds.mock.invocationCallOrder[0]
      ).toBeLessThan(
        mockJournalEntryService.postDraftReceipt.mock.invocationCallOrder[0]
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

  it.each([null, { ...originalEntry, accountingEntityId: generateUUID() }])(
    'rejects a missing or foreign journal before participant lookup',
    async (entry) => {
      mockJournalEntryRepo.findById.mockResolvedValue(entry);
      await expect(usecase(originalEntry.id)).rejects.toThrow(
        appError.ResourceNotFound
      );
      expect(mockCounterpartyRepo.findById).not.toHaveBeenCalled();
      expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
    }
  );

  it('passes optional counterparties through without looking up null IDs', async () => {
    const entry = {
      ...originalEntry,
      lines: originalEntry.lines.map((line) => ({
        ...line,
        counterpartyId: null,
      })),
    };
    mockJournalEntryRepo.findById.mockResolvedValue(entry);
    await usecase(entry.id);
    expect(mockCounterpartyRepo.findById).not.toHaveBeenCalled();
    expect(mockJournalEntryService.postDraftReceipt).toHaveBeenCalledWith(
      {
        entry,
        accounts: [account, revenueAccount],
        counterparties: [],
        actor: actorId,
      },
      transactionOptions
    );
  });

  it.each([
    'journal',
    'counterparty',
    'account',
    'posting',
    'FX',
    'persistence',
    'FX persistence',
    'outbox',
    'commit',
  ] as const)(
    'propagates %s failures without publishing or enqueueing',
    async (phase) => {
      const failure = new repoError.VersionNotFound();
      const failures = {
        journal: mockJournalEntryRepo.findById,
        counterparty: mockCounterpartyRepo.findById,
        account: mockLedgerAccountRepo.findAllByIds,
        posting: mockJournalEntryService.postDraftReceipt,
        FX: mockFxLotAppService.acquire,
        persistence: mockJournalEntryPersistenceAppService.rectify,
        'FX persistence':
          mockFxLotCostBasisAppService.persistence.persistAcquisition,
        outbox: mockOutboxAppService.createBalancePropagation,
        commit: mockRepoTransaction.commit,
      };
      mockFxLotAppService.acquire.mockResolvedValue({
        records: {} as TFxLotAcquisitionAppResult['records'],
        events: [],
      });
      failures[phase].mockRejectedValueOnce(failure);
      await expect(usecase(originalEntry.id)).rejects.toBe(failure);
      expect(mockEventBus.publish).not.toHaveBeenCalled();
      expect(
        mockLedgerAccountBalanceAdjustmentQueue.add
      ).not.toHaveBeenCalled();
      if (phase === 'journal' || phase === 'counterparty') {
        expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
      } else {
        expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(failure);
      }
      if (phase !== 'commit') {
        expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
      }
    }
  );
});
