import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService, {
  mockRepoTransaction,
} from '@shared/contracts/__mocks__/repo.mock';
import { ERepoLock } from '@shared/types/repo.types';
import generateUUID from '@shared/utils/uuid-generator';
import appError from '@shared/values/errors/app.error';
import repoError from '@shared/values/errors/repo.error';

import counterpartyEntity from '@domain/counterparty/entities/counterparty.entity';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/types/app-context.types';
import { mockCounterpartyRepo } from '@app/counterparty/contracts/__mocks__/counterparty.repos.mock';
import mockJournalEntryPersistenceAppService from '@app/journal-entry/contracts/__mocks__/journal-entry-persistence.service.mock';
import { mockTransferEntryService } from '@app/journal-entry/contracts/__mocks__/journal-entry.domain.services.mock';
import { mockJournalEntryRepo } from '@app/journal-entry/contracts/__mocks__/journal-entry.repos.mock';
import makePostDraftTransferUsecase from '@app/journal-entry/usecases/post-draft-transfer.usecase';
import mockLedgerAccountBalanceAdjustmentQueue from '@app/ledger/contracts/__mocks__/ledger-balance-adjustment-queue.mock';
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import mockExchangeRateAppService from '@app/money/contracts/__mocks__/exchange-rate.service.mock';
import { mockFxCostBasisLotService } from '@app/subledger/contracts/__mocks__/subledger.domain.services.mock';
import {
  makeFxAcquisitionResult,
  makeFxDispositionResult,
} from '@app/subledger/fx-cost-basis/__fixtures__/fx-lot-results.fixture';
import mockFxLotCostBasisAppService from '@app/subledger/fx-cost-basis/contracts/__mocks__/fx-cost-basis-persistence.service.mock';

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
const [destinationAccount] = ledgerAccountEntity.make({
  ...account,
  code: '300001',
  materializedPath: '300000.300001',
  name: 'Destination cash',
  type: 'asset',
  subType: 'cash_and_cash_equivalent',
  behavior: 'petty_cash',
  normalBalance: 'debit',
  openingBalanceDate: null,
});
const [chargeAccount] = ledgerAccountEntity.make({
  ...account,
  code: '507001',
  materializedPath: '507000.507001',
  name: 'Bank charges',
  type: 'expense',
  subType: 'bank_charge',
  behavior: 'bank_charge',
  openingBalanceDate: null,
});
const [counterparty] = counterpartyEntity.make({
  accountingEntityId: account.accountingEntityId,
  createdBy: actorId,
  name: 'Vendor',
  type: 'organization',
});
const [originalEntry] = journalEntryEntity.make({
  accountingEntityId: account.accountingEntityId,
  createdBy: actorId,
  sourceType: 'transfer',
  memo: 'Bank transfer',
  effectiveDate,
  postedAt: null,
  functionalCurrency: SYSTEM_CURRENCIES.NGN,
  lines: [
    {
      accountId: account.id,
      counterpartyId: null,
      sequenceOrder: 1,
      side: 'credit',
      amount: { amount: 10000n, currency: SYSTEM_CURRENCIES.NGN },
      exchangeRate: null,
      description: 'Transfer source',
      functionalCurrency: SYSTEM_CURRENCIES.NGN,
    },
    {
      accountId: destinationAccount.id,
      counterpartyId: null,
      sequenceOrder: 2,
      side: 'debit',
      amount: { amount: 9500n, currency: SYSTEM_CURRENCIES.NGN },
      exchangeRate: null,
      description: null,
      functionalCurrency: SYSTEM_CURRENCIES.NGN,
    },
    ...[3, 4].map((sequenceOrder) => ({
      accountId: chargeAccount.id,
      counterpartyId: counterparty.id,
      sequenceOrder,
      side: 'debit' as const,
      amount: { amount: 250n, currency: SYSTEM_CURRENCIES.NGN },
      exchangeRate: null,
      description: 'Transfer fee',
      functionalCurrency: SYSTEM_CURRENCIES.NGN,
    })),
  ],
});
const posting = journalEntryEntity.update(
  originalEntry,
  { id: originalEntry.id, status: 'posted', postedAt: new Date() },
  actorId
);
const repoOptions = { correlationId: 'post-transfer' };
const transactionOptions = { ...repoOptions, tx: mockRepoTransaction.context };
const lockedReadOptions = { ...transactionOptions, lock: ERepoLock.Share };
const usecase = makePostDraftTransferUsecase({
  appContext: mockAppContext,
  counterpartyRepo: mockCounterpartyRepo,
  ledgerAccountRepo: mockLedgerAccountRepo,
  journalEntryRepo: mockJournalEntryRepo,
  transferEntryService: mockTransferEntryService,
  journalEntryPersistenceAppService: mockJournalEntryPersistenceAppService,
  fxCostBasisLotService: mockFxCostBasisLotService,
  exchangeRateAppService: mockExchangeRateAppService,
  fxCostBasisPersistenceAppService: mockFxLotCostBasisAppService.persistence,
  ledgerBalanceAdjustmentQueue: mockLedgerAccountBalanceAdjustmentQueue,
  repoService: mockRepoService,
  eventBus: mockEventBus,
});

describe('post draft transfer use case', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockExchangeRateAppService.getOfficialRate.mockResolvedValue(null);
    mockAppContext.get.mockReturnValue({
      actor: { id: actorId },
      accountingEntity: { id: account.accountingEntityId },
      ...repoOptions,
      idempotencyKey: 'request',
    } as IAppContextData);
    mockLedgerAccountRepo.findAllByIds.mockResolvedValue([
      account,
      destinationAccount,
      chargeAccount,
    ]);
    mockJournalEntryRepo.findById.mockResolvedValue(originalEntry);
    mockTransferEntryService.postDraft.mockResolvedValue({
      journalEntry: posting,
      sourceAccount: account,
      destinationAssetAccount: destinationAccount,
    });
    mockCounterpartyRepo.findById.mockResolvedValue(counterparty);
    mockFxCostBasisLotService.dispose.mockResolvedValue(null);
    mockFxCostBasisLotService.acquire.mockReturnValue(null);
    mockRepoService.createTransaction.mockResolvedValue(mockRepoTransaction);
    mockRepoTransaction.handleError.mockImplementation(async (error) => {
      throw error;
    });
  });

  it('commits without writes or downstream effects when posting returns no audit', async () => {
    mockJournalEntryRepo.findById.mockResolvedValue(posting[0]);
    mockTransferEntryService.postDraft.mockResolvedValue({
      journalEntry: [posting[0], [], null],
      sourceAccount: account,
      destinationAssetAccount: destinationAccount,
    });

    await expect(usecase(posting[0].id)).resolves.toBeUndefined();

    expect(mockTransferEntryService.postDraft).toHaveBeenCalledWith(
      expect.objectContaining({ entry: posting[0], actor: actorId }),
      transactionOptions
    );
    expect(mockRepoTransaction.commit).toHaveBeenCalledTimes(1);
    expect(mockRepoTransaction.handleError).not.toHaveBeenCalled();
    expect(mockRepoTransaction.dispose).not.toHaveBeenCalled();
    expect(
      mockJournalEntryPersistenceAppService.rectify
    ).not.toHaveBeenCalled();
    expect(mockFxCostBasisLotService.acquire).not.toHaveBeenCalled();
    expect(mockFxCostBasisLotService.dispose).not.toHaveBeenCalled();
    expect(
      mockFxLotCostBasisAppService.persistence.persistAcquisition
    ).not.toHaveBeenCalled();
    expect(
      mockFxLotCostBasisAppService.persistence.persistDisposition
    ).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
  });

  it.each([
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ])(
    'posts the transfer atomically, disposition=%s, acquisition=%s',
    async (hasFx, hasAcquisition) => {
      const fxDisposition = makeFxDispositionResult();
      const [[, consumedLotEvents]] = fxDisposition.lots;
      const [, dispositionEvents] = fxDisposition.disposition;
      if (hasFx) {
        mockFxCostBasisLotService.dispose.mockResolvedValue(fxDisposition);
      }

      const fxAcquisition = makeFxAcquisitionResult();
      const [, acquiredLotEvents] = fxAcquisition.lot;
      const [, acquisitionEvents] = fxAcquisition.acquisition;
      if (hasAcquisition) {
        mockFxCostBasisLotService.acquire.mockReturnValue(fxAcquisition);
      }

      await expect(usecase(originalEntry.id)).resolves.toBeUndefined();
      expect(mockFxCostBasisLotService.acquire).toHaveBeenCalledWith({
        journalEntry: posting[0],
        account: destinationAccount,
        createdBy: actorId,
        officialRate: null,
      });
      expect(
        mockFxCostBasisLotService.acquire.mock.invocationCallOrder[0]
      ).toBeLessThan(
        mockJournalEntryPersistenceAppService.rectify.mock
          .invocationCallOrder[0]
      );
      if (hasAcquisition) {
        expect(
          mockFxLotCostBasisAppService.persistence.persistAcquisition
        ).toHaveBeenCalledWith(fxAcquisition, actorId, transactionOptions);
        expect(
          mockFxLotCostBasisAppService.persistence.persistAcquisition.mock
            .invocationCallOrder[0]
        ).toBeLessThan(mockRepoTransaction.commit.mock.invocationCallOrder[0]);
      } else {
        expect(
          mockFxLotCostBasisAppService.persistence.persistAcquisition
        ).not.toHaveBeenCalled();
      }

      expect(mockLedgerAccountRepo.findAllByIds).toHaveBeenCalledWith(
        [account.id, destinationAccount.id, chargeAccount.id],
        originalEntry.accountingEntityId,
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
      expect(mockTransferEntryService.postDraft).toHaveBeenCalledWith(
        {
          entry: originalEntry,
          accounts: [account, destinationAccount, chargeAccount],
          counterparties: [counterparty],
          actor: actorId,
        },
        transactionOptions
      );
      expect(mockFxCostBasisLotService.dispose).toHaveBeenCalledWith(
        {
          journalEntry: posting[0],
          account,
          createdBy: actorId,
          officialRate: null,
        },
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
        mockTransferEntryService.postDraft.mock.invocationCallOrder[0]
      );
      expect(
        mockFxCostBasisLotService.dispose.mock.invocationCallOrder[0]
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
          mockFxLotCostBasisAppService.persistence.persistDisposition
        ).toHaveBeenCalledWith(fxDisposition, actorId, transactionOptions);
      } else {
        expect(
          mockFxLotCostBasisAppService.persistence.persistDisposition
        ).not.toHaveBeenCalled();
      }
      expect(
        mockRepoTransaction.commit.mock.invocationCallOrder[0]
      ).toBeLessThan(mockEventBus.publish.mock.invocationCallOrder[0]);
      expect(mockEventBus.publish.mock.invocationCallOrder[0]).toBeLessThan(
        mockLedgerAccountBalanceAdjustmentQueue.add.mock.invocationCallOrder[0]
      );
      expect(mockLedgerAccountBalanceAdjustmentQueue.add).toHaveBeenCalledWith(
        repoOptions.correlationId,
        {
          journalEntryId: originalEntry.id,
        }
      );
      expect(mockEventBus.publish).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'domain:journal-entry:updated',
          data: posting[0],
          ...repoOptions,
          idempotencyKey: 'request',
        }),
        ...(hasFx
          ? [...consumedLotEvents, ...dispositionEvents].map(({ type, data }) =>
              expect.objectContaining({
                type,
                data,
                ...repoOptions,
                idempotencyKey: 'request',
              })
            )
          : []),
        ...(hasAcquisition
          ? [...acquiredLotEvents, ...acquisitionEvents].map(({ type, data }) =>
              expect.objectContaining({
                type,
                data,
                ...repoOptions,
                idempotencyKey: 'request',
              })
            )
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
    expect(mockTransferEntryService.postDraft).toHaveBeenCalledWith(
      {
        entry,
        accounts: [account, destinationAccount, chargeAccount],
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
    'acquisition',
    'acquisition persistence',
    'commit',
  ] as const)(
    'propagates %s failures without publishing or enqueueing',
    async (phase) => {
      const failure = new repoError.VersionNotFound();
      const failures = {
        journal: mockJournalEntryRepo.findById,
        counterparty: mockCounterpartyRepo.findById,
        account: mockLedgerAccountRepo.findAllByIds,
        posting: mockTransferEntryService.postDraft,
        FX: mockFxCostBasisLotService.dispose,
        persistence: mockJournalEntryPersistenceAppService.rectify,
        'FX persistence':
          mockFxLotCostBasisAppService.persistence.persistDisposition,
        'acquisition persistence':
          mockFxLotCostBasisAppService.persistence.persistAcquisition,
        commit: mockRepoTransaction.commit,
      };
      mockFxCostBasisLotService.dispose.mockResolvedValue(
        makeFxDispositionResult()
      );
      mockFxCostBasisLotService.acquire.mockReturnValue(
        makeFxAcquisitionResult()
      );
      if (phase === 'acquisition') {
        mockFxCostBasisLotService.acquire.mockImplementationOnce(() => {
          throw failure;
        });
      } else {
        failures[phase].mockRejectedValueOnce(failure);
      }
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
