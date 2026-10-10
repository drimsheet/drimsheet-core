import mockRepoService from '@shared/contracts/__mocks__/repo.mock';
import { EOutboxType } from '@shared/types/outbox.types';
import { ITransactionContext } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';
import historyValue from '@shared/values/history/history.vo';

import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import {
  EExchangeRateType,
  IExchangeRate,
} from '@domain/money/types/exchange-rate.types';
import moneyValue from '@domain/money/values/money.vo';
import fxCostBasisLotAcquisitionEntity from '@domain/subledger/fx-cost-basis/entities/acquisition.entity';
import fxCostBasisLotDispositionAllocationEntity from '@domain/subledger/fx-cost-basis/entities/disposition-allocation.entity';
import fxCostBasisLotDispositionEntity from '@domain/subledger/fx-cost-basis/entities/disposition.entity';
import fxCostBasisLotEntity from '@domain/subledger/fx-cost-basis/entities/lot.entity';
import { EFxCostBasisLotStatus } from '@domain/subledger/fx-cost-basis/types/lot.types';

import mockOutboxRepo from '@app/outbox/contracts/__mocks__/outbox.repo.mock';
import { EMissingOfficialFxRateEffectKind } from '@app/outbox/types/missing-official-fx-rate.types';
import {
  mockFxCostBasisLotAcquisitionRepo,
  mockFxCostBasisLotDispositionAllocationRepo,
  mockFxCostBasisLotDispositionRepo,
  mockFxCostBasisLotRepo,
} from '@app/subledger/contracts/__mocks__/subledger.repos.mock';
import makeFxLotCostBasisPersistenceAppService from '@app/subledger/fx-cost-basis/services/fx-cost-basis-persistence.service';

describe('fxCostBasisPersistenceAppService', () => {
  const correlationId = 'test-corr-id';
  const actor = generateUUID() as TEntityId;
  const mockDate = new Date('2026-03-14T00:00:00.000Z');

  const mockRate = {
    currencyPair: 'USD/NGN',
    baseCurrencyCode: 'USD',
    targetCurrencyCode: 'NGN',
    rate: 1500,
    type: EExchangeRateType.Negotiated,
    asOf: mockDate,
    source: 'bank',
    createdAt: mockDate,
  };

  const getService = () =>
    makeFxLotCostBasisPersistenceAppService({
      lotRepo: mockFxCostBasisLotRepo,
      acquisitionRepo: mockFxCostBasisLotAcquisitionRepo,
      dispositionRepo: mockFxCostBasisLotDispositionRepo,
      dispositionAllocationRepo: mockFxCostBasisLotDispositionAllocationRepo,
      outboxRepo: mockOutboxRepo,
      repoService: mockRepoService,
    });

  const makeAcquisitionBundle = (officialRate: IExchangeRate | null) => {
    const [lot, , lotAudit] = fxCostBasisLotEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      ledgerAccountId: generateUUID(),
      accountingEntityId: generateUUID(),
      status: EFxCostBasisLotStatus.Open,
      originalQuantity: moneyValue.make(10, SYSTEM_CURRENCIES.USD, false),
      remainingQuantity: moneyValue.make(10, SYSTEM_CURRENCIES.USD, false),
      costBasis: moneyValue.make(15000, SYSTEM_CURRENCIES.NGN, false),
      remainingCostBasis: moneyValue.make(15000, SYSTEM_CURRENCIES.NGN, false),
      acquisitionRate: mockRate,
      acquisitionDate: mockDate,
    });
    const [acquisition, , acquisitionAudit] =
      fxCostBasisLotAcquisitionEntity.make({
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        ledgerAccountId: lot.ledgerAccountId,
        accountingEntityId: lot.accountingEntityId,
        lotId: lot.id,
        journalEntryId: generateUUID(),
        quantity: lot.originalQuantity,
        costBasis: lot.costBasis,
        acquisitionRate: mockRate,
        officialRate,
        acquisitionDate: mockDate,
      });
    const lotHistory = historyValue.make(lotAudit, actor, correlationId);
    const acquisitionHistory = historyValue.make(
      acquisitionAudit,
      actor,
      correlationId
    );
    const missingOfficialRateOutbox =
      officialRate === null
        ? {
            id: acquisition.id,
            correlationId,
            type: EOutboxType.MissingOfficialFxRate,
            data: {
              effectKind: EMissingOfficialFxRateEffectKind.Acquisition,
              journalEntryId: acquisition.journalEntryId,
              accountingEntityId: acquisition.accountingEntityId,
              createdBy: actor,
              effectiveDate: acquisition.acquisitionDate,
            },
          }
        : null;

    return {
      lot,
      acquisition,
      lotHistory,
      acquisitionHistory,
      missingOfficialRateOutbox,
    };
  };

  const makeDispositionBundle = (officialRate: IExchangeRate | null = null) => {
    const quantity = moneyValue.make(10, SYSTEM_CURRENCIES.USD, false);
    const costBasis = moneyValue.make(14000, SYSTEM_CURRENCIES.NGN, false);
    const proceeds = moneyValue.make(15000, SYSTEM_CURRENCIES.NGN, false);
    const realizedGainLoss = moneyValue.subtract(proceeds, costBasis);
    const [openLot] = fxCostBasisLotEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      ledgerAccountId: generateUUID(),
      accountingEntityId: generateUUID(),
      status: EFxCostBasisLotStatus.Open,
      originalQuantity: quantity,
      remainingQuantity: quantity,
      costBasis,
      remainingCostBasis: costBasis,
      acquisitionRate: mockRate,
      acquisitionDate: mockDate,
    });
    const [lot, , lotAudit] = fxCostBasisLotEntity.consume(
      openLot,
      quantity,
      costBasis
    );
    const [disposition, , dispositionAudit] =
      fxCostBasisLotDispositionEntity.make({
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        ledgerAccountId: lot.ledgerAccountId,
        accountingEntityId: lot.accountingEntityId,
        journalEntryId: generateUUID(),
        quantity,
        costBasisConsumed: costBasis,
        proceeds,
        realizedGainLoss,
        dispositionRate: mockRate,
        officialRate,
        dispositionDate: mockDate,
      });
    const allocation = fxCostBasisLotDispositionAllocationEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      dispositionId: disposition.id,
      lotId: lot.id,
      quantity,
      costBasisConsumed: costBasis,
      proceeds,
      realizedGainLoss,
    });

    return {
      lot,
      disposition,
      allocation,
      lotHistory: historyValue.make(lotAudit, actor, correlationId),
      dispositionHistory: historyValue.make(
        dispositionAudit,
        actor,
        correlationId
      ),
      missingOfficialRateOutbox:
        officialRate === null
          ? {
              id: disposition.id,
              correlationId,
              type: EOutboxType.MissingOfficialFxRate,
              data: {
                effectKind: EMissingOfficialFxRateEffectKind.Disposition,
                journalEntryId: disposition.journalEntryId,
                accountingEntityId: disposition.accountingEntityId,
                createdBy: actor,
                effectiveDate: disposition.dispositionDate,
              },
            }
          : null,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepoService.runInTransaction
      .mockReset()
      .mockImplementation(async (transactionFn) =>
        transactionFn('mock-tx' as unknown as ITransactionContext)
      );
  });

  it('persists a lot and acquisition in one transaction', async () => {
    const service = getService();

    const [mockLot, mockLotEvents, mockLotAudit] = fxCostBasisLotEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      ledgerAccountId: generateUUID(),
      accountingEntityId: generateUUID(),
      status: EFxCostBasisLotStatus.Open,
      originalQuantity: moneyValue.make(1000, SYSTEM_CURRENCIES.USD, true),
      remainingQuantity: moneyValue.make(1000, SYSTEM_CURRENCIES.USD, true),
      costBasis: moneyValue.make(1500000, SYSTEM_CURRENCIES.NGN, true),
      remainingCostBasis: moneyValue.make(1500000, SYSTEM_CURRENCIES.NGN, true),
      acquisitionRate: mockRate,
      acquisitionDate: mockDate,
    });

    const [mockAcquisition, mockAcquisitionEvents, mockAcquisitionAudit] =
      fxCostBasisLotAcquisitionEntity.make({
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        ledgerAccountId: mockLot.ledgerAccountId,
        accountingEntityId: mockLot.accountingEntityId,
        lotId: mockLot.id,
        journalEntryId: generateUUID(),
        quantity: moneyValue.make(1000, SYSTEM_CURRENCIES.USD, true),
        costBasis: moneyValue.make(1500000, SYSTEM_CURRENCIES.NGN, true),
        acquisitionRate: mockRate,
        officialRate: null,
        acquisitionDate: mockDate,
      });

    const lotHistory = historyValue.make(mockLotAudit, actor, correlationId);
    const acquisitionHistory = historyValue.make(
      mockAcquisitionAudit,
      actor,
      correlationId
    );

    const repoOptions = { correlationId };

    const missingOfficialRateOutbox = {
      id: mockAcquisition.id,
      correlationId,
      type: EOutboxType.MissingOfficialFxRate,
      data: {
        effectKind: EMissingOfficialFxRateEffectKind.Acquisition,
        journalEntryId: mockAcquisition.journalEntryId,
        accountingEntityId: mockAcquisition.accountingEntityId,
        createdBy: actor,
        effectiveDate: mockAcquisition.acquisitionDate,
      },
    };

    await service.persistAcquisition(
      {
        lot: mockLot,
        acquisition: mockAcquisition,
        lotHistory,
        acquisitionHistory,
        missingOfficialRateOutbox,
      },
      repoOptions
    );

    expect(mockFxCostBasisLotRepo.create).toHaveBeenCalledWith(
      mockLot,
      expect.objectContaining({
        correlationId,
        tx: 'mock-tx',
        history: lotHistory,
      })
    );

    expect(mockFxCostBasisLotAcquisitionRepo.create).toHaveBeenCalledWith(
      mockAcquisition,
      expect.objectContaining({
        correlationId,
        tx: 'mock-tx',
        history: acquisitionHistory,
      })
    );
    expect(mockOutboxRepo.create).toHaveBeenCalledWith(
      missingOfficialRateOutbox,
      expect.objectContaining({ correlationId, tx: 'mock-tx' })
    );
  });

  it('persists a rated acquisition without an outbox row', async () => {
    const service = getService();
    const bundle = makeAcquisitionBundle(mockRate);

    await service.persistAcquisition(bundle, { correlationId });

    expect(mockFxCostBasisLotRepo.create).toHaveBeenCalled();
    expect(mockFxCostBasisLotAcquisitionRepo.create).toHaveBeenCalled();
    expect(mockOutboxRepo.create).not.toHaveBeenCalled();
  });

  it('persists updated lots, disposition, and allocations in one transaction', async () => {
    const service = getService();
    const {
      lot,
      disposition,
      allocation,
      lotHistory,
      dispositionHistory,
      missingOfficialRateOutbox,
    } = makeDispositionBundle();

    await service.persistDisposition(
      {
        lots: [{ lot, history: lotHistory, expectedVersion: lot.version - 1 }],
        disposition,
        dispositionHistory,
        allocations: [allocation],
        missingOfficialRateOutbox,
      },
      {
        correlationId,
        tx: 'caller-tx' as unknown as ITransactionContext,
      }
    );

    expect(mockRepoService.runInTransaction).toHaveBeenCalledWith(
      expect.any(Function),
      'caller-tx'
    );

    expect(mockFxCostBasisLotRepo.update).toHaveBeenCalledWith(
      lot,
      expect.objectContaining({ tx: 'mock-tx', history: lotHistory })
    );
    expect(mockFxCostBasisLotDispositionRepo.create).toHaveBeenCalledWith(
      disposition,
      expect.objectContaining({ tx: 'mock-tx', history: dispositionHistory })
    );
    expect(
      mockFxCostBasisLotDispositionAllocationRepo.create
    ).toHaveBeenCalledWith(
      allocation,
      expect.objectContaining({ tx: 'mock-tx' })
    );
    expect(mockOutboxRepo.create).toHaveBeenCalledWith(
      {
        id: disposition.id,
        correlationId,
        type: EOutboxType.MissingOfficialFxRate,
        data: {
          effectKind: EMissingOfficialFxRateEffectKind.Disposition,
          journalEntryId: disposition.journalEntryId,
          accountingEntityId: disposition.accountingEntityId,
          createdBy: actor,
          effectiveDate: disposition.dispositionDate,
        },
      },
      expect.objectContaining({ correlationId, tx: 'mock-tx' })
    );
  });

  it('does not recompute domain accounting aggregates before persistence', async () => {
    const service = getService();
    const bundle = makeDispositionBundle();
    const allocationWithDifferentQuantity = {
      ...bundle.allocation,
      quantity: moneyValue.make(9, SYSTEM_CURRENCIES.USD, false),
    };

    await service.persistDisposition(
      {
        lots: [
          {
            lot: bundle.lot,
            history: bundle.lotHistory,
            expectedVersion: bundle.lot.version - 1,
          },
        ],
        disposition: bundle.disposition,
        dispositionHistory: bundle.dispositionHistory,
        allocations: [allocationWithDifferentQuantity],
        missingOfficialRateOutbox: bundle.missingOfficialRateOutbox,
      },
      { correlationId }
    );

    expect(
      mockFxCostBasisLotDispositionAllocationRepo.create
    ).toHaveBeenCalledWith(
      allocationWithDifferentQuantity,
      expect.objectContaining({ tx: 'mock-tx' })
    );
  });

  it('persists a rated disposition without an outbox row', async () => {
    const service = getService();
    const bundle = makeDispositionBundle(mockRate);

    await service.persistDisposition(
      {
        lots: [
          {
            lot: bundle.lot,
            history: bundle.lotHistory,
            expectedVersion: bundle.lot.version - 1,
          },
        ],
        disposition: bundle.disposition,
        dispositionHistory: bundle.dispositionHistory,
        allocations: [bundle.allocation],
        missingOfficialRateOutbox: null,
      },
      { correlationId }
    );

    expect(mockFxCostBasisLotDispositionRepo.create).toHaveBeenCalled();
    expect(mockOutboxRepo.create).not.toHaveBeenCalled();
  });

  it('persists prepared FX lot reversal updates in the caller transaction', async () => {
    const service = getService();
    const bundle = makeDispositionBundle();
    const [reversedLot, , reversalAudit] =
      fxCostBasisLotEntity.reverseDisposition(
        bundle.lot,
        bundle.allocation.quantity,
        bundle.allocation.costBasisConsumed
      );
    const reversalHistory = historyValue.make(
      reversalAudit,
      actor,
      correlationId
    );

    await service.persistReversal(
      {
        lots: [
          {
            lot: reversedLot,
            history: reversalHistory,
            expectedVersion: bundle.lot.version,
          },
        ],
      },
      {
        correlationId,
        tx: 'caller-tx' as unknown as ITransactionContext,
      }
    );

    expect(mockRepoService.runInTransaction).toHaveBeenCalledWith(
      expect.any(Function),
      'caller-tx'
    );
    expect(mockFxCostBasisLotRepo.update).toHaveBeenCalledWith(
      reversedLot,
      expect.objectContaining({
        correlationId,
        tx: 'mock-tx',
        expectedVersion: bundle.lot.version,
        history: reversalHistory,
      })
    );
  });
});
