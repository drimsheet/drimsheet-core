import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService, {
  mockRepoTransaction,
} from '@shared/contracts/__mocks__/repo.mock';
import generateUUID from '@shared/utils/uuid-generator';
import appError from '@shared/values/errors/app.error';

import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import { EJournalEntryEvent } from '@domain/journal-entry/events/journal-entry.events';
import { EJournalEntrySourceType } from '@domain/journal-entry/types/journal-entry.types';
import { EJournalSide } from '@domain/journal-entry/types/journal-line.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/types/app-context.types';
import mockJournalEntryPersistenceAppService from '@app/journal-entry/contracts/__mocks__/journal-entry-persistence.service.mock';
import {
  mockJournalEntryAttachmentRepo,
  mockJournalEntryHistoryRepo,
  mockJournalEntryRepo,
  mockJournalLineHistoryRepo,
  mockJournalLineRepo,
} from '@app/journal-entry/contracts/__mocks__/journal-entry.repos.mock';
import makeJournalEntryPersistenceAppService from '@app/journal-entry/services/journal-entry-persistence.service';
import makeDeleteJournalEntryUsecase from '@app/journal-entry/usecases/delete-journal-entry.usecase';
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';

describe('makeDeleteJournalEntryUsecase', () => {
  const correlationId = 'delete-journal-entry-correlation-id';
  const idempotencyKey = 'delete-journal-entry-idempotency-key';
  const accountingEntityId = generateUUID();
  const userId = generateUUID();
  const now = new Date('2026-09-22T10:00:00.000Z');
  const usecase = makeDeleteJournalEntryUsecase({
    appContext: mockAppContext,
    eventBus: mockEventBus,
    journalEntryPersistenceAppService: mockJournalEntryPersistenceAppService,
    journalEntryRepo: mockJournalEntryRepo,
  });

  function makeEntry(postedAt: Date | null) {
    const amount = moneyValue.make(100, SYSTEM_CURRENCIES.NGN, false);

    return journalEntryEntity.make({
      accountingEntityId,
      sourceType: EJournalEntrySourceType.Expense,
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

  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      correlationId,
      idempotencyKey,
      accountingEntity: { id: accountingEntityId },
    } as IAppContextData);
  });

  it('deletes a draft and publishes its deletion event', async () => {
    const entry = makeEntry(null);
    mockJournalEntryRepo.findById.mockResolvedValue(entry);

    await expect(usecase(entry.id)).resolves.toBeUndefined();

    expect(mockJournalEntryRepo.findById).toHaveBeenCalledWith(entry.id, {
      correlationId,
      idempotencyKey,
    });
    expect(mockJournalEntryPersistenceAppService.delete).toHaveBeenCalledWith(
      {
        journalEntryId: entry.id,
        expectedVersion: entry.version,
      },
      { correlationId, idempotencyKey }
    );
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: EJournalEntryEvent.Deleted,
        data: entry,
        correlationId,
        idempotencyKey,
        enrichedAt: expect.any(Date),
      })
    );
  });

  it.each([
    ['posted', makeEntry(now)],
    ['archived draft', journalEntryEntity.archive(makeEntry(null))[0]],
    ['archived after posting', journalEntryEntity.archive(makeEntry(now))[0]],
  ])(
    'rejects a %s entry before writing or publishing events',
    async (_, entry) => {
      mockJournalEntryRepo.findById.mockResolvedValue(entry);

      await expect(usecase(entry.id)).rejects.toThrow(
        journalEntryError.DeletionNotPermitted
      );

      expect(
        mockJournalEntryPersistenceAppService.delete
      ).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    }
  );

  it.each([false, true])(
    'waits for the persistence transaction and publishes only after a successful commit (commit fails: %s)',
    async (commitFails) => {
      const entry = makeEntry(null);
      const failure = new Error('commit failed');
      const persistence = makeJournalEntryPersistenceAppService({
        repoService: mockRepoService,
        ledgerAccountRepo: mockLedgerAccountRepo,
        journalEntryRepo: mockJournalEntryRepo,
        journalEntryHistoryRepo: mockJournalEntryHistoryRepo,
        journalLineHistoryRepo: mockJournalLineHistoryRepo,
        journalLineRepo: mockJournalLineRepo,
        journalEntryAttachmentRepo: mockJournalEntryAttachmentRepo,
      });
      mockJournalEntryRepo.findById.mockResolvedValue(entry);
      mockJournalEntryPersistenceAppService.delete.mockImplementationOnce(
        persistence.delete
      );

      let release!: () => void;
      let started!: () => void;
      const blocked = new Promise<void>((resolve) => {
        release = resolve;
      });
      const ready = new Promise<void>((resolve) => {
        started = resolve;
      });
      mockRepoService.runInTransaction.mockImplementationOnce(
        async (transactionFn) => {
          const result = await transactionFn(mockRepoTransaction.context);
          started();
          await blocked;
          if (commitFails) {
            throw failure;
          }
          return result;
        }
      );

      const outcome = usecase(entry.id).then(
        () => undefined,
        (error: unknown) => error
      );
      try {
        await ready;
        expect(mockJournalEntryRepo.delete).toHaveBeenCalledWith(entry.id, {
          correlationId,
          idempotencyKey,
          tx: mockRepoTransaction.context,
          expectedVersion: entry.version,
        });
        expect(mockEventBus.publish).not.toHaveBeenCalled();
      } finally {
        release();
        await outcome;
      }

      expect(await outcome).toBe(commitFails ? failure : undefined);
      expect(mockEventBus.publish).toHaveBeenCalledTimes(commitFails ? 0 : 1);
    }
  );

  it('does not publish deletion events when persistence fails', async () => {
    const entry = makeEntry(null);
    const failure = new Error('deletion failed');
    mockJournalEntryRepo.findById.mockResolvedValue(entry);
    mockJournalEntryPersistenceAppService.delete.mockRejectedValueOnce(failure);

    await expect(usecase(entry.id)).rejects.toBe(failure);

    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('propagates publication failure after deletion commits', async () => {
    const entry = makeEntry(null);
    const failure = new Error('publication failed');
    mockJournalEntryRepo.findById.mockResolvedValue(entry);
    mockEventBus.publish.mockRejectedValueOnce(failure);

    await expect(usecase(entry.id)).rejects.toBe(failure);

    expect(mockJournalEntryPersistenceAppService.delete).toHaveBeenCalledTimes(
      1
    );
    expect(mockEventBus.publish.mock.invocationCallOrder[0]).toBeGreaterThan(
      mockJournalEntryPersistenceAppService.delete.mock.invocationCallOrder[0]
    );
  });

  it('validates the id before reading context', async () => {
    await expect(usecase('not-a-uuid')).rejects.toThrow(
      journalEntryError.InvalidJournalEntry
    );

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
  ])('rejects a %s entry before deletion', async (_, entry, ErrorType) => {
    mockJournalEntryRepo.findById.mockResolvedValue(entry);

    await expect(usecase(entry?.id ?? generateUUID())).rejects.toThrow(
      ErrorType
    );

    expect(mockJournalEntryPersistenceAppService.delete).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });
});
