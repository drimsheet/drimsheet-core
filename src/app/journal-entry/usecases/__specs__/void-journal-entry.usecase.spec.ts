import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService, {
  mockRepoTransaction,
} from '@shared/contracts/__mocks__/repo.mock';
import { ERepoLock } from '@shared/types/repo.types';
import generateUUID from '@shared/utils/uuid-generator';
import appError from '@shared/values/errors/app.error';

import periodError from '@domain/accounting/errors/period.error';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import { EJournalEntryEvent } from '@domain/journal-entry/events/journal-entry.events';
import { EJournalEntryAuditAction } from '@domain/journal-entry/types/journal-entry-audit.types';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
} from '@domain/journal-entry/types/journal-entry.types';
import { EJournalSide } from '@domain/journal-entry/types/journal-line.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';
import fxCostBasisLotEntity from '@domain/subledger/fx-cost-basis/entities/lot.entity';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/types/app-context.types';
import mockJournalEntryPersistenceAppService from '@app/journal-entry/contracts/__mocks__/journal-entry-persistence.service.mock';
import { mockJournalEntryService } from '@app/journal-entry/contracts/__mocks__/journal-entry.domain.services.mock';
import { mockJournalEntryRepo } from '@app/journal-entry/contracts/__mocks__/journal-entry.repos.mock';
import makeVoidJournalEntryUsecase from '@app/journal-entry/usecases/void-journal-entry.usecase';
import mockLedgerBalanceAdjustmentQueue from '@app/ledger/contracts/__mocks__/ledger-balance-adjustment-queue.mock';
import { mockFxCostBasisLotService } from '@app/subledger/contracts/__mocks__/subledger.domain.services.mock';
import { makeFxAcquisitionResult } from '@app/subledger/fx-cost-basis/__fixtures__/fx-lot-results.fixture';
import mockFxLotCostBasisAppService from '@app/subledger/fx-cost-basis/contracts/__mocks__/fx-cost-basis-persistence.service.mock';

describe('makeVoidJournalEntryUsecase', () => {
  const actorId = generateUUID();
  const accountingEntityId = generateUUID();
  const effectiveDate = new Date('2026-04-15T00:00:00.000Z');
  const repoOptions = {
    correlationId: 'void-journal-entry-correlation-id',
    idempotencyKey: 'void-journal-entry-idempotency-key',
  };
  const writeOptions = { ...repoOptions, tx: mockRepoTransaction.context };
  const lockedReadOptions = { ...writeOptions, lock: ERepoLock.Share };
  const accountIds = [generateUUID(), generateUUID()];
  const usecase = makeVoidJournalEntryUsecase({
    appContext: mockAppContext,
    eventBus: mockEventBus,
    fxCostBasisLotService: mockFxCostBasisLotService,
    fxCostBasisPersistenceAppService: mockFxLotCostBasisAppService.persistence,
    journalEntryPersistenceAppService: mockJournalEntryPersistenceAppService,
    journalEntryRepo: mockJournalEntryRepo,
    journalEntryService: mockJournalEntryService,
    ledgerBalanceAdjustmentQueue: mockLedgerBalanceAdjustmentQueue,
    repoService: mockRepoService,
  });

  function makeEntry(postedAt: Date | null = effectiveDate) {
    const currency = SYSTEM_CURRENCIES.NGN;
    return journalEntryEntity.make({
      accountingEntityId,
      sourceType: EJournalEntrySourceType.Payment,
      effectiveDate,
      postedAt,
      memo: null,
      createdBy: actorId,
      functionalCurrency: currency,
      lines: [EJournalSide.Debit, EJournalSide.Credit].map((side, index) => ({
        accountId: accountIds[index],
        sequenceOrder: index + 1,
        amount: moneyValue.make(100n, currency, true),
        exchangeRate: null,
        side,
        description: null,
        functionalCurrency: currency,
      })),
    })[0];
  }

  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      ...repoOptions,
      actor: { id: actorId },
      accountingEntity: { id: accountingEntityId },
    } as IAppContextData);
    mockFxCostBasisLotService.reverse.mockResolvedValue(null);
    mockJournalEntryService.void.mockImplementation(async (entry, actorId) =>
      journalEntryEntity.void(entry, actorId)
    );
    mockRepoService.createTransaction.mockResolvedValue(mockRepoTransaction);
    mockRepoTransaction.commit.mockResolvedValue();
    mockRepoTransaction.handleError.mockImplementation(async (error) => {
      throw error;
    });
  });

  it.each([false, true])(
    'commits the void, reversal, and histories before queuing balance work (FX: %s)',
    async (hasFx) => {
      const original = makeEntry();
      mockJournalEntryRepo.findById.mockResolvedValue(original);

      const [lot] = makeFxAcquisitionResult().lot;
      const fxReversal = {
        lots: [
          fxCostBasisLotEntity.reverseAcquisition(
            lot,
            lot.remainingQuantity,
            lot.remainingCostBasis
          ),
        ],
      };
      if (hasFx) {
        mockFxCostBasisLotService.reverse.mockResolvedValue(fxReversal);
      }

      await usecase(original.id);

      const [[reversal, reversalHistory, lineHistories, createOptions]] =
        mockJournalEntryPersistenceAppService.create.mock.calls;
      expect(reversal).toMatchObject({
        sourceType: EJournalEntrySourceType.Reversal,
        status: EJournalEntryStatus.Posted,
        effectiveDate: original.effectiveDate,
      });
      expect(reversalHistory).toMatchObject({
        entityId: reversal.id,
        actorId,
        action: EJournalEntryAuditAction.Created,
      });
      expect(lineHistories.map((history) => history.entityId)).toEqual(
        reversal.lines.map((line) => line.id)
      );
      expect(createOptions).toEqual(writeOptions);
      expect(mockJournalEntryService.void).toHaveBeenCalledWith(
        original,
        actorId,
        lockedReadOptions
      );
      expect(mockFxCostBasisLotService.reverse).toHaveBeenCalledWith(
        original.id,
        writeOptions
      );
      expect(mockJournalEntryRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: original.id,
          status: EJournalEntryStatus.Voided,
          voidingEntryId: reversal.id,
          version: original.version + 1,
        }),
        {
          ...writeOptions,
          expectedVersion: original.version,
          history: expect.objectContaining({
            entityId: original.id,
            actorId,
            action: EJournalEntryAuditAction.Voided,
          }),
        }
      );
      expect(
        mockJournalEntryPersistenceAppService.create.mock.invocationCallOrder[0]
      ).toBeLessThan(mockJournalEntryRepo.update.mock.invocationCallOrder[0]);
      const { persistReversal } = mockFxLotCostBasisAppService.persistence;
      if (hasFx) {
        expect(persistReversal).toHaveBeenCalledWith(
          fxReversal,
          actorId,
          writeOptions
        );
      } else {
        expect(persistReversal).not.toHaveBeenCalled();
      }
      expect(mockRepoTransaction.commit).toHaveBeenCalledTimes(1);
      expect(
        mockJournalEntryRepo.update.mock.invocationCallOrder[0]
      ).toBeLessThan(mockRepoTransaction.commit.mock.invocationCallOrder[0]);
      expect(
        mockRepoTransaction.commit.mock.invocationCallOrder[0]
      ).toBeLessThan(
        mockLedgerBalanceAdjustmentQueue.add.mock.invocationCallOrder[0]
      );
      expect(
        mockRepoTransaction.commit.mock.invocationCallOrder[0]
      ).toBeLessThan(mockEventBus.publish.mock.invocationCallOrder[0]);
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ type: EJournalEntryEvent.Voided }),
          expect.objectContaining({ type: EJournalEntryEvent.Created }),
        ])
      );
      expect(mockLedgerBalanceAdjustmentQueue.add).toHaveBeenCalledWith(
        repoOptions.correlationId,
        { journalEntryId: reversal.id }
      );
    }
  );

  it('returns without writes or events for an already voided entry', async () => {
    const original = makeEntry();
    const {
      voided: [entry],
    } = journalEntryEntity.void(original, actorId);
    mockJournalEntryRepo.findById.mockResolvedValue(entry);

    await usecase(original.id);

    expect(mockFxCostBasisLotService.reverse).not.toHaveBeenCalled();
    expect(mockJournalEntryPersistenceAppService.create).not.toHaveBeenCalled();
    expect(mockJournalEntryRepo.update).not.toHaveBeenCalled();
    expect(mockRepoTransaction.commit).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    expect(mockLedgerBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
  });

  it('rejects a malformed ID before reading the journal', async () => {
    await expect(usecase('invalid')).rejects.toThrow(
      appError.UnprocessableEntity
    );
    expect(mockJournalEntryRepo.findById).not.toHaveBeenCalled();
  });

  it.each([null, { ...makeEntry(), accountingEntityId: generateUUID() }])(
    'hides a missing or foreign journal',
    async (entry) => {
      mockJournalEntryRepo.findById.mockResolvedValue(entry);
      await expect(usecase(entry?.id ?? generateUUID())).rejects.toThrow(
        appError.ResourceNotFound
      );
      expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
    }
  );

  it('rejects a draft before any writes', async () => {
    const draft = makeEntry(null);
    mockJournalEntryRepo.findById.mockResolvedValue(draft);

    await expect(usecase(draft.id)).rejects.toThrow(
      journalEntryError.InvalidStatusTransition
    );
    expect(mockJournalEntryPersistenceAppService.create).not.toHaveBeenCalled();
    expect(mockJournalEntryRepo.update).not.toHaveBeenCalled();
  });

  it('rejects a closed posting period before writing', async () => {
    const original = makeEntry();
    mockJournalEntryRepo.findById.mockResolvedValue(original);
    const error = new periodError.PostingPeriodNotOpen();
    mockJournalEntryService.void.mockRejectedValueOnce(error);

    await expect(usecase(original.id)).rejects.toBe(error);
    expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(error);
    expect(mockJournalEntryPersistenceAppService.create).not.toHaveBeenCalled();
    expect(mockJournalEntryRepo.update).not.toHaveBeenCalled();
    expect(mockFxCostBasisLotService.reverse).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('skips post-commit work when a transaction write fails', async () => {
    const original = makeEntry();
    mockJournalEntryRepo.findById.mockResolvedValue(original);
    const error = new Error('journal update failed');
    mockJournalEntryRepo.update.mockRejectedValueOnce(error);

    await expect(usecase(original.id)).rejects.toBe(error);
    expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(error);
    expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    expect(mockLedgerBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
  });
  it('skips balance propagation and events when commit fails', async () => {
    const original = makeEntry();
    mockJournalEntryRepo.findById.mockResolvedValue(original);
    const error = new Error('commit failed');
    mockRepoTransaction.commit.mockRejectedValueOnce(error);

    await expect(usecase(original.id)).rejects.toBe(error);
    expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(error);
    expect(mockLedgerBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });
});
