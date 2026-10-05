import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService from '@shared/contracts/__mocks__/repo.mock';
import { ITransactionContext } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';
import appError from '@shared/values/errors/app.error';

import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import makeJournalEntryRectificationService from '@domain/journal-entry/services/journal-entry-rectification.service';
import { EJournalEntryRemovalMode } from '@domain/journal-entry/types/journal-entry-removal.types';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
  IJournalEntry,
  UJournalEntrySourceType,
} from '@domain/journal-entry/types/journal-entry.types';
import { EJournalSide } from '@domain/journal-entry/types/journal-line.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';
import actorEntity from '@domain/user/entities/actor.entity';

import { mockAccountingEntityService } from '@app/accounting/contracts/__mocks__/accounting.domain.services.mock';
import mockAppContext, {
  mockClientSession,
} from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/contracts/app-context.contract';
import mockJournalEntryPersistenceService from '@app/journal-entry/contracts/__mocks__/journal-entry-persistence.service.mock';
import { mockJournalEntryRemovalService } from '@app/journal-entry/contracts/__mocks__/journal-entry.domain.services.mock';
import { mockJournalEntryRepo } from '@app/journal-entry/contracts/__mocks__/journal-entry.repos.mock';
import makeDeleteJournalEntryUsecase from '@app/journal-entry/usecases/delete-journal-entry.usecase';
import mockLedgerBalanceAdjustmentQueue from '@app/ledger/contracts/__mocks__/ledger-balance-adjustment-queue.mock';
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import mockOutboxService from '@app/outbox/contracts/__mocks__/outbox.service.mock';
import mockFxLotCostBasisService from '@app/subledger/fx-cost-basis/contracts/__mocks__/fx-cost-basis-persistence.service.mock';
import mockFxLotAppService from '@app/subledger/fx-cost-basis/contracts/__mocks__/fx-lot.service.mock';

const actor = {
  ...actorEntity.makeUser({
    email: 'actor@example.com',
    displayName: 'Actor',
  })[0],
  id: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
};

describe('makeDeleteJournalEntryUsecase', () => {
  const correlationId = 'delete-journal-entry-correlation-id';
  const idempotencyKey = 'delete-journal-entry-idempotency-key';
  const accountingEntityId = generateUUID();
  const userId = generateUUID();
  const now = new Date('2026-09-22T10:00:00.000Z');
  const rectificationService = makeJournalEntryRectificationService({
    ledgerAccountRepo: mockLedgerAccountRepo,
  });
  const usecase = makeDeleteJournalEntryUsecase({
    accountingEntityService: mockAccountingEntityService,
    appContext: mockAppContext,
    eventBus: mockEventBus,
    fxCostBasisPersistenceService: mockFxLotCostBasisService.persistence,
    fxLotAppService: mockFxLotAppService,
    journalEntryPersistenceService: mockJournalEntryPersistenceService,
    journalEntryRemovalService: mockJournalEntryRemovalService,
    journalEntryRepo: mockJournalEntryRepo,
    ledgerBalanceAdjustmentQueue: mockLedgerBalanceAdjustmentQueue,
    outboxService: mockOutboxService,
    repoService: mockRepoService,
  });

  function makeEntry(
    postedAt: Date | null,
    sourceType: UJournalEntrySourceType = EJournalEntrySourceType.Expense
  ) {
    const amount = moneyValue.make(100, SYSTEM_CURRENCIES.NGN, false);

    return journalEntryEntity.make({
      accountingEntityId,
      sourceType,
      effectiveDate: now,
      postedAt,
      memo: 'Expense',
      createdBy: userId,
      functionalCurrency: SYSTEM_CURRENCIES.NGN,
      lines: [
        {
          accountId: generateUUID(),
          sequenceOrder: 1,
          amount,
          exchangeRate: null,
          side: EJournalSide.Debit,
          description: null,
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
        },
        {
          accountId: generateUUID(),
          sequenceOrder: 2,
          amount,
          exchangeRate: null,
          side: EJournalSide.Credit,
          description: null,
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
        },
      ],
    })[0];
  }

  function prepareDeletion(entry: IJournalEntry) {
    return {
      mode: EJournalEntryRemovalMode.Delete,
      originalJournalEntryId: entry.id,
    } as const;
  }

  async function prepareReversal(entry: IJournalEntry) {
    return {
      mode: EJournalEntryRemovalMode.Reverse,
      ...(await rectificationService.reverse(
        entry,
        'a1111111-1111-4111-8111-111111111111' as TEntityId,
        { correlationId }
      )),
    } as const;
  }

  beforeEach(() => {
    mockLedgerAccountRepo.findAllByIds.mockResolvedValue([]);
    jest.useFakeTimers();
    jest.setSystemTime(now);
    jest.clearAllMocks();
    mockAppContext.get.mockReturnValue({
      actor,
      correlationId,
      idempotencyKey,
      user: {
        id: userId,
        actorId: 'b2222222-2222-4222-8222-222222222222' as TEntityId,
      },
      accountingEntity: { id: accountingEntityId },
      clientSession: mockClientSession,
    } as unknown as IAppContextData);
    mockRepoService.runInTransaction.mockImplementation(async (transactionFn) =>
      transactionFn('delete-tx' as unknown as ITransactionContext)
    );
    mockJournalEntryPersistenceService.delete.mockResolvedValue();
    mockJournalEntryPersistenceService.rectify.mockResolvedValue();
    mockFxLotAppService.reverse.mockResolvedValue(null);
    mockFxLotCostBasisService.persistence.persistReversal.mockResolvedValue();
    mockOutboxService.createBalancePropagation.mockResolvedValue();
    mockLedgerBalanceAdjustmentQueue.add.mockResolvedValue();
    mockEventBus.publish.mockResolvedValue();
  });

  afterEach(() => jest.useRealTimers());

  it('blocks reversing deletion when an original account is archived', async () => {
    const entry = makeEntry(now);
    mockJournalEntryRepo.findById.mockResolvedValue(entry);
    const failure = new journalEntryError.ArchivedLedgerAccountNotAllowed();
    mockJournalEntryRemovalService.prepare.mockRejectedValueOnce(failure);
    await expect(
      usecase(entry.id, { expectedVersion: entry.version })
    ).rejects.toBe(failure);
    expect(mockJournalEntryPersistenceService.rectify).not.toHaveBeenCalled();
    expect(mockJournalEntryPersistenceService.delete).not.toHaveBeenCalled();
    expect(mockOutboxService.createBalancePropagation).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });
  it.each([
    ['draft', makeEntry(null)],
    [
      'never-posted archived',
      { ...makeEntry(null), status: EJournalEntryStatus.Archived },
    ],
  ])(
    'totally deletes a %s entry without accounting side effects',
    async (_, entry) => {
      mockJournalEntryRepo.findById.mockResolvedValue(entry);
      mockJournalEntryRemovalService.prepare.mockResolvedValue(
        prepareDeletion(entry)
      );

      await expect(
        usecase(entry.id, { expectedVersion: entry.version })
      ).resolves.toBeUndefined();

      expect(mockJournalEntryPersistenceService.delete).toHaveBeenCalledWith(
        {
          journalEntryId: entry.id,
          expectedVersion: entry.version,
        },
        { correlationId, idempotencyKey }
      );
      expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
      expect(mockJournalEntryPersistenceService.rectify).not.toHaveBeenCalled();
      expect(mockFxLotAppService.reverse).not.toHaveBeenCalled();
      expect(mockOutboxService.createBalancePropagation).not.toHaveBeenCalled();
      expect(mockLedgerBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['posted', makeEntry(now)],
    [
      'previously-posted archived',
      { ...makeEntry(now), status: EJournalEntryStatus.Archived },
    ],
  ])('reverses a %s entry atomically before propagation', async (_, entry) => {
    const removal = await prepareReversal(entry);
    mockJournalEntryRepo.findById.mockResolvedValue(entry);
    mockJournalEntryRemovalService.prepare.mockResolvedValue(removal);

    await expect(
      usecase(entry.id, { expectedVersion: entry.version })
    ).resolves.toBeUndefined();

    expect(mockFxLotAppService.reverse).toHaveBeenCalledWith(
      entry.id,
      'a1111111-1111-4111-8111-111111111111' as TEntityId,
      { correlationId, idempotencyKey }
    );
    expect(mockJournalEntryPersistenceService.rectify).toHaveBeenCalledWith(
      expect.objectContaining({
        entriesToCreate: [
          expect.objectContaining({
            entry: removal.reversingJournalEntry,
          }),
        ],
        entryUpdate: expect.objectContaining({
          entry: removal.entryUpdate.entry,
          expectedVersion: entry.version,
        }),
      }),
      { correlationId, tx: 'delete-tx' }
    );
    expect(mockOutboxService.createBalancePropagation).toHaveBeenCalledWith(
      removal.reversingJournalEntry.id,
      { correlationId, tx: 'delete-tx' }
    );
    expect(mockLedgerBalanceAdjustmentQueue.add).toHaveBeenCalledWith({
      journalEntryId: removal.reversingJournalEntry.id,
      correlationId,
    });
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    expect(
      mockJournalEntryPersistenceService.rectify.mock.invocationCallOrder[0]
    ).toBeLessThan(
      mockOutboxService.createBalancePropagation.mock.invocationCallOrder[0]
    );
    expect(
      mockRepoService.runInTransaction.mock.invocationCallOrder[0]
    ).toBeLessThan(
      mockLedgerBalanceAdjustmentQueue.add.mock.invocationCallOrder[0]
    );
  });

  it('persists an optional FX reversal in the journal transaction', async () => {
    const entry = makeEntry(now);
    const removal = await prepareReversal(entry);
    const fxReversal = { records: { lots: [] }, events: [] };
    mockJournalEntryRepo.findById.mockResolvedValue(entry);
    mockJournalEntryRemovalService.prepare.mockResolvedValue(removal);
    mockFxLotAppService.reverse.mockResolvedValue(fxReversal);

    await usecase(entry.id, { expectedVersion: entry.version });

    expect(
      mockFxLotCostBasisService.persistence.persistReversal
    ).toHaveBeenCalledWith(fxReversal.records, {
      correlationId,
      tx: 'delete-tx',
    });
    expect(
      mockJournalEntryPersistenceService.rectify.mock.invocationCallOrder[0]
    ).toBeLessThan(
      mockFxLotCostBasisService.persistence.persistReversal.mock
        .invocationCallOrder[0]
    );
  });

  it.each([
    ['reversal source', makeEntry(now, EJournalEntrySourceType.Reversal)],
    ['voided', { ...makeEntry(now), status: EJournalEntryStatus.Voided }],
  ])('does not persist a rejected %s entry', async (_, entry) => {
    mockJournalEntryRepo.findById.mockResolvedValue(entry);
    mockJournalEntryRemovalService.prepare.mockImplementation(() => {
      throw new journalEntryError.DeletionNotPermitted();
    });

    await expect(
      usecase(entry.id, { expectedVersion: entry.version })
    ).rejects.toThrow(journalEntryError.DeletionNotPermitted);

    expect(mockJournalEntryPersistenceService.delete).not.toHaveBeenCalled();
    expect(mockJournalEntryPersistenceService.rectify).not.toHaveBeenCalled();
    expect(mockFxLotAppService.reverse).not.toHaveBeenCalled();
  });

  it('validates id and body before reading context', async () => {
    await expect(usecase('not-a-uuid', { expectedVersion: 0 })).rejects.toThrow(
      journalEntryError.InvalidJournalEntry
    );
    await expect(
      usecase(generateUUID(), { expectedVersion: 0 })
    ).rejects.toThrow();

    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockJournalEntryRepo.findById).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', null, appError.ResourceNotFound],
    [
      'outside accounting scope',
      { ...makeEntry(null), accountingEntityId: generateUUID() },
      appError.ResourceNotFound,
    ],
    ['stale', { ...makeEntry(null), version: 2 }, appError.Conflict],
  ])(
    'rejects a %s entry before preparing removal',
    async (_, entry, ErrorType) => {
      mockJournalEntryRepo.findById.mockResolvedValue(entry);

      await expect(
        usecase(entry?.id ?? generateUUID(), { expectedVersion: 1 })
      ).rejects.toThrow(ErrorType);

      expect(mockJournalEntryRemovalService.prepare).not.toHaveBeenCalled();
    }
  );

  it('does not run post-commit work when reversal persistence fails', async () => {
    const entry = makeEntry(now);
    const failure = new Error('journal persistence failed');
    mockJournalEntryRepo.findById.mockResolvedValue(entry);
    mockJournalEntryRemovalService.prepare.mockResolvedValue(
      await prepareReversal(entry)
    );
    mockJournalEntryPersistenceService.rectify.mockRejectedValueOnce(failure);

    await expect(
      usecase(entry.id, { expectedVersion: entry.version })
    ).rejects.toBe(failure);

    expect(mockLedgerBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });
});
