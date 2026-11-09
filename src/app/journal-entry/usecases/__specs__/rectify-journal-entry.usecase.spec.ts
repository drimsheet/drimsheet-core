import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService, {
  mockRepoTransaction,
} from '@shared/contracts/__mocks__/repo.mock';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';
import appError from '@shared/values/errors/app.error';

import periodError from '@domain/accounting/errors/period.error';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import makeJournalEntryRectificationService from '@domain/journal-entry/services/journal-entry-rectification.service';
import {
  EJournalEntryRectificationMode,
  EJournalEntrySourceType,
  EJournalEntryStatus,
} from '@domain/journal-entry/types/journal-entry.types';
import { EJournalSide } from '@domain/journal-entry/types/journal-line.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';
import actorEntity from '@domain/user/entities/actor.entity';

import { mockAccountingPeriodService } from '@app/accounting/contracts/__mocks__/accounting.domain.services.mock';
import mockAppContext, {
  mockClientSession,
} from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/types/app-context.types';
import { mockCounterpartyRepo } from '@app/counterparty/contracts/__mocks__/counterparty.repos.mock';
import mockJournalEntryPersistenceAppService from '@app/journal-entry/contracts/__mocks__/journal-entry-persistence.service.mock';
import mockJournalEntryRectificationPreparationAppService from '@app/journal-entry/contracts/__mocks__/journal-entry-rectification-preparation.service.mock';
import { mockJournalEntryRepo } from '@app/journal-entry/contracts/__mocks__/journal-entry.repos.mock';
import {
  ITransferJournalEntryRectificationReq,
  TJournalEntryRectificationReq,
} from '@app/journal-entry/dtos/journal-entry-rectification/journal-entry-rectification.dto';
import makeRectifyJournalEntryUsecase from '@app/journal-entry/usecases/rectify-journal-entry.usecase';
import mockLedgerAccountBalanceAdjustmentQueue from '@app/ledger/contracts/__mocks__/ledger-balance-adjustment-queue.mock';
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import mockOutboxAppService from '@app/outbox/contracts/__mocks__/outbox.service.mock';
import {
  makeFxAcquisitionResult,
  makeFxDispositionResult,
} from '@app/subledger/fx-cost-basis/__fixtures__/fx-lot-results.fixture';
import mockFxLotCostBasisAppService from '@app/subledger/fx-cost-basis/contracts/__mocks__/fx-cost-basis-persistence.service.mock';

const actor = {
  ...actorEntity.makeUser({
    email: 'actor@example.com',
    displayName: 'Actor',
  })[0],
  id: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
};

describe('makeRectifyJournalEntryUsecase', () => {
  const correlationId = 'rectification-correlation-id';
  const idempotencyKey = 'rectification-idempotency-key';
  const userId = generateUUID();
  const accountingEntityId = generateUUID();
  const sourceAccount = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: generateUUID(),
  } as ILedgerAccount;
  const destinationAccount = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: generateUUID(),
  } as ILedgerAccount;
  const effectiveDate = new Date('2026-09-01T00:00:00.000Z');
  const now = new Date('2026-09-21T10:00:00.000Z');
  const rectificationService = makeJournalEntryRectificationService({
    accountingPeriodService: mockAccountingPeriodService,
    ledgerAccountRepo: mockLedgerAccountRepo,
  });

  function makeEntry(
    amountValue: number,
    description = 'Transfer',
    postedAt: Date | null = effectiveDate
  ) {
    const amount = moneyValue.make(amountValue, SYSTEM_CURRENCIES.NGN, false);

    return journalEntryEntity.make({
      accountingEntityId,
      sourceType: EJournalEntrySourceType.Transfer,
      effectiveDate,
      postedAt,
      memo: 'Move funds',
      createdBy: userId,
      functionalCurrency: SYSTEM_CURRENCIES.NGN,
      attachments: [],
      lines: [
        {
          accountId: sourceAccount.id,
          counterpartyId: null,
          sequenceOrder: 1,
          amount,
          exchangeRate: null,
          side: EJournalSide.Credit,
          description,
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
        },
        {
          accountId: destinationAccount.id,
          counterpartyId: null,
          sequenceOrder: 2,
          amount,
          exchangeRate: null,
          side: EJournalSide.Debit,
          description: null,
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
        },
      ],
    });
  }

  function makePayload(
    originalEntry: ReturnType<typeof makeEntry>[0],
    amount = 150,
    description = 'Transfer'
  ): ITransferJournalEntryRectificationReq {
    return {
      sourceType: 'transfer',
      attachments: [],
      effectiveDate,
      postedAt: effectiveDate,
      memo: 'Move funds',
      sourceLine: {
        id: originalEntry.lines[0].id,
        accountId: sourceAccount.id,
        amount: {
          amount,
          currencyCode: SYSTEM_CURRENCIES.NGN.code,
          isMinorUnit: false,
        },
        exchangeRate: null,
        description,
        sequenceOrder: 1,
      },
      destinationLine: {
        id: originalEntry.lines[1].id,
        accountId: destinationAccount.id,
        amount: {
          amount,
          currencyCode: SYSTEM_CURRENCIES.NGN.code,
          isMinorUnit: false,
        },
        exchangeRate: null,
        description: null,
        sequenceOrder: 2,
      },
      chargeLines: [],
    };
  }

  function getUsecase() {
    return makeRectifyJournalEntryUsecase({
      appContext: mockAppContext,
      journalEntryRepo: mockJournalEntryRepo,
      journalEntryRectificationPreparationAppService:
        mockJournalEntryRectificationPreparationAppService,
      journalEntryPersistenceAppService: mockJournalEntryPersistenceAppService,
      repoService: mockRepoService,
      eventBus: mockEventBus,
      outboxAppService: mockOutboxAppService,
      ledgerBalanceAdjustmentQueue: mockLedgerAccountBalanceAdjustmentQueue,
      fxCostBasisPersistenceAppService:
        mockFxLotCostBasisAppService.persistence,
    });
  }

  beforeEach(() => {
    mockLedgerAccountRepo.findAllByIds.mockResolvedValue([]);
    jest.useFakeTimers();
    jest.setSystemTime(now);
    jest.clearAllMocks();
    mockAccountingPeriodService.validatePostingPeriod.mockReset();
    mockAppContext.get.mockReturnValue({
      actor,
      correlationId,
      idempotencyKey,
      accountingEntity: {
        id: accountingEntityId,
        functionalCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
      },
      clientSession: mockClientSession,
    } as unknown as IAppContextData);
    mockRepoService.createTransaction
      .mockReset()
      .mockResolvedValue(mockRepoTransaction);
    mockRepoTransaction.commit.mockReset().mockResolvedValue();
    mockRepoTransaction.handleError
      .mockReset()
      .mockImplementation(async (error) => {
        throw error;
      });
    mockEventBus.publish.mockResolvedValue();
    mockOutboxAppService.createBalancePropagation.mockResolvedValue();
    mockLedgerAccountBalanceAdjustmentQueue.add.mockResolvedValue();
  });

  afterEach(() => jest.useRealTimers());

  it('returns an unchanged rectification without writes, events, or propagation', async () => {
    const [originalEntry] = makeEntry(100);
    mockJournalEntryRepo.findById.mockResolvedValue(originalEntry);
    mockJournalEntryRectificationPreparationAppService.prepare.mockResolvedValueOnce(
      {
        rectification: {
          mode: 'update_meta',
          originalJournalEntryId: originalEntry.id,
          currentJournalEntry: originalEntry,
          reversingJournalEntry: null,
          entriesToCreate: [],
          entryUpdate: null,
          events: [],
        },
        fxReversal: null,
        fxDisposition: null,
        fxAcquisition: null,
      }
    );
    await getUsecase()(originalEntry.id, makePayload(originalEntry));
    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
    expect(
      mockJournalEntryPersistenceAppService.rectify
    ).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    expect(
      mockOutboxAppService.createBalancePropagation
    ).not.toHaveBeenCalled();
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
  });

  it('blocks a correction when a persisted original account is archived', async () => {
    const [originalEntry] = makeEntry(100);
    mockJournalEntryRepo.findById.mockResolvedValue(originalEntry);
    const failure = new journalEntryError.ArchivedLedgerAccountNotAllowed();
    mockJournalEntryRectificationPreparationAppService.prepare.mockRejectedValueOnce(
      failure
    );
    await expect(
      getUsecase()(originalEntry.id, makePayload(originalEntry))
    ).rejects.toBe(failure);
    expect(
      mockJournalEntryPersistenceAppService.rectify
    ).not.toHaveBeenCalled();
    expect(
      mockOutboxAppService.createBalancePropagation
    ).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });
  it('persists and propagates a reversing and corrected journal entry', async () => {
    const [originalEntry] = makeEntry(100);
    const newEntryResult = makeEntry(150);
    const newEntry = {
      ...newEntryResult[0],
      lines: newEntryResult[0].lines.map((line, index) => ({
        ...line,
        id: originalEntry.lines[index].id,
      })),
    };
    const result = await rectificationService.rectify(
      {
        actorId: actor.id,
        originalEntry,
        newEntry,
      },
      { correlationId }
    );
    mockJournalEntryRepo.findById.mockResolvedValue(originalEntry);
    const fxDisposition = makeFxDispositionResult();
    const fxAcquisition = makeFxAcquisitionResult();
    const fxReversal = { lots: [] };
    mockJournalEntryRectificationPreparationAppService.prepare.mockResolvedValue(
      {
        rectification: result,
        fxReversal,
        fxDisposition,
        fxAcquisition,
      }
    );

    const response = await getUsecase()(
      originalEntry.id,
      makePayload(originalEntry)
    );

    expect(
      mockJournalEntryRectificationPreparationAppService.prepare
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        originalEntry,
        requestedEntry: expect.objectContaining({
          sourceType: EJournalEntrySourceType.Transfer,
        }),
        actor: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      }),
      { correlationId, idempotencyKey }
    );
    expect(mockJournalEntryPersistenceAppService.rectify).toHaveBeenCalledWith(
      expect.objectContaining({
        entriesToCreate: expect.arrayContaining([
          expect.objectContaining({
            entry: expect.objectContaining({
              sourceType: EJournalEntrySourceType.Reversal,
            }),
          }),
          expect.objectContaining({ entry: result.currentJournalEntry }),
        ]),
        entryUpdate: expect.objectContaining({
          entry: expect.objectContaining({
            status: EJournalEntryStatus.Voided,
          }),
        }),
      }),
      expect.objectContaining({ tx: mockRepoTransaction.context })
    );
    expect(mockOutboxAppService.createBalancePropagation).toHaveBeenCalledTimes(
      2
    );
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).toHaveBeenCalledTimes(
      2
    );
    expect(
      mockLedgerAccountBalanceAdjustmentQueue.add.mock.calls.map(
        (call) => call[0]
      )
    ).toEqual([correlationId, correlationId]);
    expect(mockCounterpartyRepo.create).not.toHaveBeenCalled();
    expect(
      mockFxLotCostBasisAppService.persistence.persistReversal
    ).toHaveBeenCalledWith(fxReversal, actor.id, expect.any(Object));
    expect(
      mockFxLotCostBasisAppService.persistence.persistDisposition
    ).toHaveBeenCalledWith(fxDisposition, actor.id, expect.any(Object));
    expect(
      mockFxLotCostBasisAppService.persistence.persistAcquisition
    ).toHaveBeenCalledWith(fxAcquisition, actor.id, expect.any(Object));
    expect(response).toMatchObject({
      mode: EJournalEntryRectificationMode.VoidAndReplace,
      originalJournalEntryId: originalEntry.id,
      currentJournalEntryId: result.currentJournalEntry.id,
      reversingJournalEntryId: result.reversingJournalEntry?.id,
    });
  });

  it('does not persist metadata requests rejected by rectification preparation', async () => {
    const [originalEntry] = makeEntry(100);
    mockJournalEntryRepo.findById.mockResolvedValue(originalEntry);
    mockJournalEntryRectificationPreparationAppService.prepare.mockRejectedValueOnce(
      new journalEntryError.RectificationHasNoChanges()
    );
    await expect(
      getUsecase()(
        originalEntry.id,
        makePayload(originalEntry, 100, 'Corrected description')
      )
    ).rejects.toThrow(journalEntryError.RectificationHasNoChanges);
    expect(
      mockJournalEntryPersistenceAppService.rectify
    ).not.toHaveBeenCalled();
    expect(
      mockOutboxAppService.createBalancePropagation
    ).not.toHaveBeenCalled();
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
  });

  it('prepares current FX effects when a draft rectification is posted', async () => {
    const [originalEntry] = makeEntry(100, 'Transfer', null);
    const candidateResult = makeEntry(100);
    const candidate = {
      ...candidateResult[0],
      lines: candidateResult[0].lines.map((line, index) => ({
        ...line,
        id: originalEntry.lines[index].id,
      })),
    };
    const result = await rectificationService.rectify(
      {
        actorId: actor.id,
        originalEntry,
        newEntry: candidate,
      },
      { correlationId }
    );
    mockJournalEntryRepo.findById.mockResolvedValue(originalEntry);
    mockJournalEntryRectificationPreparationAppService.prepare.mockResolvedValue(
      {
        rectification: result,
        fxReversal: null,
        fxDisposition: null,
        fxAcquisition: null,
      }
    );

    await getUsecase()(originalEntry.id, makePayload(originalEntry, 100));

    expect(mockOutboxAppService.createBalancePropagation).toHaveBeenCalledTimes(
      1
    );
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).toHaveBeenCalledTimes(
      1
    );
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).toHaveBeenCalledWith(
      correlationId,
      { journalEntryId: result.currentJournalEntry.id }
    );
  });

  it('hides journal entries outside the active accounting entity', async () => {
    const [originalEntry] = makeEntry(100);
    mockJournalEntryRepo.findById.mockResolvedValue({
      ...originalEntry,
      accountingEntityId: generateUUID(),
    });

    await expect(
      getUsecase()(originalEntry.id, makePayload(originalEntry))
    ).rejects.toBeInstanceOf(appError.ResourceNotFound);
  });

  it('does not persist an archived entry rejected by domain preparation', async () => {
    const [originalEntry] = makeEntry(100);
    const archivedEntry = {
      ...originalEntry,
      status: EJournalEntryStatus.Archived,
    };
    mockJournalEntryRepo.findById.mockResolvedValue(archivedEntry);
    mockJournalEntryRectificationPreparationAppService.prepare.mockRejectedValue(
      new journalEntryError.RectificationNotPermitted({
        status: EJournalEntryStatus.Archived,
      })
    );

    await expect(
      getUsecase()(archivedEntry.id, makePayload(archivedEntry))
    ).rejects.toBeInstanceOf(journalEntryError.RectificationNotPermitted);

    expect(
      mockJournalEntryPersistenceAppService.rectify
    ).not.toHaveBeenCalled();
    expect(
      mockOutboxAppService.createBalancePropagation
    ).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it.each([
    ['account', journalEntryError.DraftLedgerAccountNotAllowed],
    ['counterparty', journalEntryError.DraftCounterpartyNotAllowed],
  ] as const)(
    'stops rectification writes when a draft %s blocks posting',
    async (_, ErrorType) => {
      const [originalEntry] = makeEntry(100);
      const error = new ErrorType();
      mockJournalEntryRepo.findById.mockResolvedValue(originalEntry);
      mockJournalEntryRectificationPreparationAppService.prepare.mockRejectedValueOnce(
        error
      );

      await expect(
        getUsecase()(originalEntry.id, makePayload(originalEntry))
      ).rejects.toBe(error);

      expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
      expect(mockCounterpartyRepo.create).not.toHaveBeenCalled();
      expect(
        mockJournalEntryPersistenceAppService.rectify
      ).not.toHaveBeenCalled();
      expect(
        mockFxLotCostBasisAppService.persistence.persistReversal
      ).not.toHaveBeenCalled();
      expect(
        mockFxLotCostBasisAppService.persistence.persistDisposition
      ).not.toHaveBeenCalled();
      expect(
        mockFxLotCostBasisAppService.persistence.persistAcquisition
      ).not.toHaveBeenCalled();
      expect(
        mockOutboxAppService.createBalancePropagation
      ).not.toHaveBeenCalled();
      expect(
        mockLedgerAccountBalanceAdjustmentQueue.add
      ).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    }
  );

  it('propagates domain rejection of a source-type change without persisting', async () => {
    const [originalEntry] = makeEntry(100);
    const transferPayload = makePayload(originalEntry);
    const payload: TJournalEntryRectificationReq = {
      sourceType: EJournalEntrySourceType.Payment,
      attachments: transferPayload.attachments,
      effectiveDate: transferPayload.effectiveDate,
      postedAt: transferPayload.postedAt,
      memo: transferPayload.memo,
      sourceLine: {
        ...transferPayload.sourceLine,
        counterpartyId: '123e4567-e89b-12d3-a456-426614174006',
      },
      destinationLines: [
        {
          ...transferPayload.destinationLine,
          counterpartyId: '123e4567-e89b-12d3-a456-426614174006',
        },
      ],
    };
    mockJournalEntryRepo.findById.mockResolvedValue(originalEntry);
    const error = new journalEntryError.RectificationNotPermitted();
    mockJournalEntryRectificationPreparationAppService.prepare.mockRejectedValue(
      error
    );

    await expect(getUsecase()(originalEntry.id, payload)).rejects.toBe(error);

    expect(
      mockJournalEntryRectificationPreparationAppService.prepare
    ).toHaveBeenCalledWith(
      expect.objectContaining({ originalEntry, requestedEntry: payload }),
      { correlationId, idempotencyKey }
    );
    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
    expect(
      mockJournalEntryPersistenceAppService.rectify
    ).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('rejects an invalid journal entry id before repository access', async () => {
    const [originalEntry] = makeEntry(100);

    await expect(
      getUsecase()('not-a-uuid', makePayload(originalEntry))
    ).rejects.toBeInstanceOf(journalEntryError.InvalidJournalEntry);

    expect(mockJournalEntryRepo.findById).not.toHaveBeenCalled();
  });
  it.each([
    periodError.PostingPeriodNotOpen,
    periodError.PostingDateNotCovered,
  ])(
    'rejects an invalid reversal period before any rectification writes (%p)',
    async (ErrorType) => {
      const [originalEntry] = makeEntry(100);
      const [replacement] = makeEntry(150);
      const snapshot = structuredClone(originalEntry);
      const replacementDate = new Date('2026-10-01T10:00:00.000Z');
      jest.setSystemTime(replacementDate);
      const failure = new ErrorType({
        accountingEntityId,
        postingDate: originalEntry.effectiveDate,
      });
      mockAccountingPeriodService.validatePostingPeriod
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(failure);
      mockJournalEntryRepo.findById.mockResolvedValue(originalEntry);
      mockJournalEntryRectificationPreparationAppService.prepare.mockImplementationOnce(
        async (payload, options) => ({
          rectification: await rectificationService.rectify(
            {
              originalEntry: payload.originalEntry,
              actorId: payload.actor,
              newEntry: { ...replacement, effectiveDate: replacementDate },
            },
            options
          ),
          fxReversal: null,
          fxDisposition: null,
          fxAcquisition: null,
        })
      );

      await expect(
        getUsecase()(originalEntry.id, {
          ...makePayload(originalEntry),
          effectiveDate: replacementDate,
        })
      ).rejects.toBe(failure);

      expect(
        mockAccountingPeriodService.validatePostingPeriod
      ).toHaveBeenNthCalledWith(1, accountingEntityId, replacementDate, {
        correlationId,
        idempotencyKey,
      });
      expect(
        mockAccountingPeriodService.validatePostingPeriod
      ).toHaveBeenNthCalledWith(
        2,
        accountingEntityId,
        originalEntry.effectiveDate,
        {
          correlationId,
          idempotencyKey,
        }
      );
      expect(originalEntry).toEqual(snapshot);
      expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
      expect(mockCounterpartyRepo.create).not.toHaveBeenCalled();
      expect(
        mockJournalEntryPersistenceAppService.rectify
      ).not.toHaveBeenCalled();
      expect(
        mockFxLotCostBasisAppService.persistence.persistReversal
      ).not.toHaveBeenCalled();
      expect(
        mockFxLotCostBasisAppService.persistence.persistDisposition
      ).not.toHaveBeenCalled();
      expect(
        mockFxLotCostBasisAppService.persistence.persistAcquisition
      ).not.toHaveBeenCalled();
      expect(
        mockOutboxAppService.createBalancePropagation
      ).not.toHaveBeenCalled();
      expect(
        mockLedgerAccountBalanceAdjustmentQueue.add
      ).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    }
  );

  it.each(['acquisition', 'persistence', 'outbox', 'commit'] as const)(
    'handles transaction %s failure without publishing or enqueueing',
    async (phase) => {
      const [originalEntry] = makeEntry(100);
      const [replacement] = makeEntry(150);
      const newEntry = {
        ...replacement,
        lines: replacement.lines.map((line, index) => ({
          ...line,
          id: originalEntry.lines[index].id,
        })),
      };
      const rectification = await rectificationService.rectify(
        { actorId: actor.id, originalEntry, newEntry },
        { correlationId }
      );
      mockJournalEntryRepo.findById.mockResolvedValue(originalEntry);
      mockJournalEntryRectificationPreparationAppService.prepare.mockResolvedValue(
        {
          rectification,
          fxReversal: null,
          fxDisposition: null,
          fxAcquisition: null,
        }
      );
      const failure = new Error('transaction failed');
      const failures = {
        acquisition: mockRepoService.createTransaction,
        persistence: mockJournalEntryPersistenceAppService.rectify,
        outbox: mockOutboxAppService.createBalancePropagation,
        commit: mockRepoTransaction.commit,
      };
      failures[phase].mockRejectedValueOnce(failure);

      await expect(
        getUsecase()(originalEntry.id, makePayload(originalEntry))
      ).rejects.toBe(failure);

      expect(mockEventBus.publish).not.toHaveBeenCalled();
      expect(
        mockLedgerAccountBalanceAdjustmentQueue.add
      ).not.toHaveBeenCalled();
      if (phase === 'acquisition') {
        expect(mockRepoTransaction.handleError).not.toHaveBeenCalled();
        expect(
          mockJournalEntryPersistenceAppService.rectify
        ).not.toHaveBeenCalled();
      } else {
        expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(failure);
      }
      if (phase !== 'commit') {
        expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
      }
    }
  );

  afterEach(() => {
    if (mockLedgerAccountBalanceAdjustmentQueue.add.mock.calls.length === 0) {
      return;
    }

    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
    expect(mockRepoTransaction.commit).toHaveBeenCalledTimes(1);
    const outboxCalls =
      mockOutboxAppService.createBalancePropagation.mock.invocationCallOrder;
    expect(outboxCalls[outboxCalls.length - 1]).toBeLessThan(
      mockRepoTransaction.commit.mock.invocationCallOrder[0]
    );
    expect(mockRepoTransaction.commit.mock.invocationCallOrder[0]).toBeLessThan(
      mockEventBus.publish.mock.invocationCallOrder[0]
    );
    expect(mockEventBus.publish.mock.invocationCallOrder[0]).toBeLessThan(
      mockLedgerAccountBalanceAdjustmentQueue.add.mock.invocationCallOrder[0]
    );
  });
});
