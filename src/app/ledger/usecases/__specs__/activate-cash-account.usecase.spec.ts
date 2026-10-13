import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService, {
  mockRepoTransaction,
} from '@shared/contracts/__mocks__/repo.mock';
import generateUUID from '@shared/utils/uuid-generator';
import repoError from '@shared/values/errors/repo.error';

import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ledgerAccountEvents from '@domain/ledger/events/ledger-account.events';
import ledgerAccountAudit from '@domain/ledger/values/ledger-account-audit.vo';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/contracts/app-context.contract';
import mockJournalEntryPersistenceAppService from '@app/journal-entry/contracts/__mocks__/journal-entry-persistence.service.mock';
import { mockJournalEntryService } from '@app/journal-entry/contracts/__mocks__/journal-entry.domain.services.mock';
import mockJournalEntryQueryRepo from '@app/journal-entry/contracts/__mocks__/journal-entry.query.repo.mock';
import mockLedgerAccountBalanceAdjustmentQueue from '@app/ledger/contracts/__mocks__/ledger-balance-adjustment-queue.mock';
import { mockAssetAccountService } from '@app/ledger/contracts/__mocks__/ledger.domain.services.mock';
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import makeActivateCashAccountUsecase from '@app/ledger/usecases/activate-cash-account.usecase';
import mockOutboxAppService from '@app/outbox/contracts/__mocks__/outbox.service.mock';
import mockFxLotCostBasisAppService from '@app/subledger/fx-cost-basis/contracts/__mocks__/fx-cost-basis-persistence.service.mock';
import mockFxLotAppService from '@app/subledger/fx-cost-basis/contracts/__mocks__/fx-lot.service.mock';
import { TFxLotAcquisitionAppResult } from '@app/subledger/fx-cost-basis/types/fx-lot.service.types';

const [header] = ledgerAccountEntity.make({
  code: '100000',
  materializedPath: '100000',
  accountingEntityId: generateUUID(),
  createdBy: generateUUID(),
  name: 'Cash',
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
  behavior: 'petty_cash',
  isControlAccount: false,
  status: 'draft',
});
const activated = Object.freeze({
  ...account,
  status: 'active' as const,
  version: 2,
});
const audit = ledgerAccountAudit.make({
  before: account,
  after: activated,
  action: 'updated',
});
const events = [ledgerAccountEvents.updated(activated)];
const actorId = generateUUID();
const usecase = makeActivateCashAccountUsecase({
  appContext: mockAppContext,
  ledgerAccountRepo: mockLedgerAccountRepo,
  cashAccountService: mockAssetAccountService,
  repoService: mockRepoService,
  eventBus: mockEventBus,
  journalEntryQueryRepo: mockJournalEntryQueryRepo,
  journalEntryService: mockJournalEntryService,
  journalEntryPersistenceAppService: mockJournalEntryPersistenceAppService,
  fxLotAppService: mockFxLotAppService,
  fxCostBasisPersistenceAppService: mockFxLotCostBasisAppService.persistence,
  outboxAppService: mockOutboxAppService,
  ledgerBalanceAdjustmentQueue: mockLedgerAccountBalanceAdjustmentQueue,
});
const repoOptions = { correlationId: 'activate' };

describe('activate cash account use case', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      actor: { id: actorId },
      accountingEntity: { id: account.accountingEntityId },
      correlationId: 'activate',
      idempotencyKey: 'request',
    } as IAppContextData);
    mockJournalEntryQueryRepo.findAll.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 1, total: 0, totalPages: 0 },
    });
    mockFxLotAppService.acquire.mockResolvedValue(null);
    mockLedgerAccountRepo.findById.mockResolvedValue(account);
    mockAssetAccountService.activate.mockResolvedValue([
      activated,
      events,
      audit,
    ]);
    mockRepoService.createTransaction.mockResolvedValue(mockRepoTransaction);
    mockRepoTransaction.handleError.mockImplementation(async (error) => {
      throw error;
    });
  });

  it('reads the scoped account once and commits its versioned update before publication', async () => {
    expect(await usecase(account.id)).toBeUndefined();
    expect(mockLedgerAccountRepo.findById).toHaveBeenNthCalledWith(
      1,
      account.id,
      account.accountingEntityId,
      { correlationId: 'activate' }
    );
    expect(mockLedgerAccountRepo.findById).toHaveBeenCalledTimes(1);
    expect(mockLedgerAccountRepo.findByCode).not.toHaveBeenCalled();
    expect(
      mockAssetAccountService.activate.mock.invocationCallOrder[0]
    ).toBeLessThan(
      mockRepoService.createTransaction.mock.invocationCallOrder[0]
    );
    expect(mockAssetAccountService.activate).toHaveBeenCalledWith(
      account,
      repoOptions
    );
    expect(mockLedgerAccountRepo.update).toHaveBeenCalledWith(activated, {
      correlationId: 'activate',
      tx: mockRepoTransaction.context,
      expectedVersion: account.version,
      history: expect.objectContaining({
        entityId: account.id,
        entityVersion: 2,
        action: 'updated',
        actorId,
        correlationId: 'activate',
      }),
    });
    expect(
      mockLedgerAccountRepo.update.mock.invocationCallOrder[0]
    ).toBeLessThan(mockRepoTransaction.commit.mock.invocationCallOrder[0]);
    expect(mockRepoTransaction.commit.mock.invocationCallOrder[0]).toBeLessThan(
      mockEventBus.publish.mock.invocationCallOrder[0]
    );
    expect(mockEventBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'domain:ledger:account:updated',
        data: activated,
        correlationId: 'activate',
        idempotencyKey: 'request',
      }),
    ]);
    expect(mockRepoTransaction.dispose).not.toHaveBeenCalled();
    expect(mockJournalEntryService.postOpeningBalance).not.toHaveBeenCalled();
    expect(
      mockJournalEntryPersistenceAppService.rectify
    ).not.toHaveBeenCalled();
    expect(
      mockOutboxAppService.createBalancePropagation
    ).not.toHaveBeenCalled();
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
  });

  it('rejects an invalid ID before reading context or repositories', async () => {
    await expect(usecase('invalid')).rejects.toBeInstanceOf(
      ledgerAccountError.InvalidId
    );
    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
  });

  it('rejects missing or out-of-entity accounts before starting a transaction', async () => {
    mockLedgerAccountRepo.findById.mockResolvedValue(null);
    await expect(usecase(account.id)).rejects.toBeInstanceOf(
      ledgerAccountError.AccountNotFound
    );
    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
  });

  it('rejects domain failures before starting a transaction', async () => {
    const error = new ledgerAccountError.InvalidStatus();
    mockAssetAccountService.activate.mockRejectedValue(error);

    await expect(usecase(account.id)).rejects.toBe(error);

    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
    expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it.each(['write', 'commit'])(
    'handles %s failure without publishing',
    async (phase) => {
      const error = new repoError.VersionNotFound();
      if (phase === 'write') {
        mockLedgerAccountRepo.update.mockRejectedValue(error);
      }
      if (phase === 'commit') {
        mockRepoTransaction.commit.mockRejectedValue(error);
      }
      await expect(usecase(account.id)).rejects.toBe(error);
      expect(mockEventBus.publish).not.toHaveBeenCalled();
      expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(error);
      expect(mockRepoTransaction.dispose).not.toHaveBeenCalled();
    }
  );
  describe('with a draft opening balance', () => {
    const effectiveDate = new Date('2026-03-01T00:00:00.000Z');
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
          accountId: generateUUID(),
          sequenceOrder: 2,
          side: 'credit',
          amount: { amount: 10000n, currency: SYSTEM_CURRENCIES.NGN },
          exchangeRate: null,
          description: null,
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
        },
      ],
    });
    const details = {
      ...originalEntry,
      lines: originalEntry.lines.map((line) => ({
        ...line,
        account: { id: line.accountId, name: 'Account' },
        counterparty: null,
      })),
    };
    const posting = journalEntryEntity.update(
      originalEntry,
      { id: originalEntry.id, status: 'posted', postedAt: effectiveDate },
      actorId
    );

    beforeEach(() => {
      mockJournalEntryQueryRepo.findAll.mockResolvedValue({
        data: [details],
        meta: { page: 1, limit: 1, total: 1, totalPages: 1 },
      });
      mockJournalEntryService.postOpeningBalance.mockResolvedValue(posting);
    });

    it.each([false, true])(
      'commits the account, existing journal, audits and outbox together, FX=%s',
      async (hasFx) => {
        const fxRecords = {} as TFxLotAcquisitionAppResult['records'];
        if (hasFx) {
          mockFxLotAppService.acquire.mockResolvedValue({
            records: fxRecords,
            events: [],
          });
        }
        await usecase(account.id);
        const transactionOptions = {
          ...repoOptions,
          tx: mockRepoTransaction.context,
        };

        expect(mockJournalEntryQueryRepo.findAll).toHaveBeenCalledWith(
          account.accountingEntityId,
          {
            ...repoOptions,
            accountId: account.id,
            sourceType: 'opening_balance',
            status: 'draft',
            limit: 1,
          }
        );
        expect(mockJournalEntryService.postOpeningBalance).toHaveBeenCalledWith(
          { entry: details, account: activated, actor: actorId },
          repoOptions
        );
        expect(mockFxLotAppService.acquire).toHaveBeenCalledWith(
          { journalEntry: posting[0], account: activated, actor: actorId },
          repoOptions
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
                correlationId: 'activate',
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
        ).toBeLessThan(
          mockLedgerAccountBalanceAdjustmentQueue.add.mock
            .invocationCallOrder[0]
        );
        expect(
          mockLedgerAccountBalanceAdjustmentQueue.add
        ).toHaveBeenCalledWith({
          journalEntryId: originalEntry.id,
          correlationId: 'activate',
        });
        expect(mockEventBus.publish).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'domain:ledger:account:updated',
              data: activated,
            }),
            expect.objectContaining({
              type: 'domain:journal-entry:updated',
              data: posting[0],
              idempotencyKey: 'request',
            }),
          ])
        );
      }
    );

    it.each(['lookup', 'posting', 'FX'])(
      'rejects %s preparation failure before any writes',
      async (phase) => {
        const failure = new journalEntryError.RectificationNotPermitted();
        if (phase === 'lookup') {
          mockJournalEntryQueryRepo.findAll.mockRejectedValue(failure);
        }
        if (phase === 'posting') {
          mockJournalEntryService.postOpeningBalance.mockRejectedValue(failure);
        }
        if (phase === 'FX') {
          mockFxLotAppService.acquire.mockRejectedValue(failure);
        }
        await expect(usecase(account.id)).rejects.toBe(failure);
        expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
        expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
        expect(
          mockJournalEntryPersistenceAppService.rectify
        ).not.toHaveBeenCalled();
        expect(mockEventBus.publish).not.toHaveBeenCalled();
      }
    );

    it.each(['account', 'journal', 'FX', 'outbox', 'commit'])(
      'rolls back on %s write failure without publishing or queueing',
      async (phase) => {
        const failure = new repoError.VersionNotFound();
        mockFxLotAppService.acquire.mockResolvedValue({
          records: {} as TFxLotAcquisitionAppResult['records'],
          events: [],
        });
        if (phase === 'account') {
          mockLedgerAccountRepo.update.mockRejectedValue(failure);
        }
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
        await expect(usecase(account.id)).rejects.toBe(failure);
        expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(failure);
        expect(mockEventBus.publish).not.toHaveBeenCalled();
        expect(
          mockLedgerAccountBalanceAdjustmentQueue.add
        ).not.toHaveBeenCalled();
        expect(mockRepoTransaction.dispose).not.toHaveBeenCalled();
      }
    );
  });
});
