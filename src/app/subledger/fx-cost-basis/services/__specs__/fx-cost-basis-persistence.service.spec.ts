import mockRepoService from '@shared/contracts/__mocks__/repo.mock';
import { EOutboxType } from '@shared/types/outbox.types';
import { ITransactionContext } from '@shared/types/repo.types';
import generateUUID from '@shared/utils/uuid-generator';
import historyValue from '@shared/values/history/history.vo';

import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';
import fxCostBasisLotEntity from '@domain/subledger/fx-cost-basis/entities/lot.entity';

import mockOutboxRepo from '@app/outbox/contracts/__mocks__/outbox.repo.mock';
import { EMissingOfficialFxRateEffectKind } from '@app/outbox/types/missing-official-fx-rate.types';
import {
  mockFxCostBasisLotAcquisitionRepo,
  mockFxCostBasisLotDispositionAllocationRepo,
  mockFxCostBasisLotDispositionRepo,
  mockFxCostBasisLotRepo,
} from '@app/subledger/contracts/__mocks__/subledger.repos.mock';
import {
  makeFxAcquisitionResult,
  makeFxDispositionResult,
} from '@app/subledger/fx-cost-basis/__fixtures__/fx-lot-results.fixture';
import makeFxLotCostBasisPersistenceAppService from '@app/subledger/fx-cost-basis/services/fx-cost-basis-persistence.service';

describe('fxCostBasisPersistenceAppService', () => {
  const correlationId = 'test-corr-id';
  const actor = generateUUID();
  const callerTransaction: ITransactionContext = {};
  const transaction: ITransactionContext = {};
  const writeOptions = { correlationId, tx: transaction };
  const service = makeFxLotCostBasisPersistenceAppService({
    lotRepo: mockFxCostBasisLotRepo,
    acquisitionRepo: mockFxCostBasisLotAcquisitionRepo,
    dispositionRepo: mockFxCostBasisLotDispositionRepo,
    dispositionAllocationRepo: mockFxCostBasisLotDispositionAllocationRepo,
    outboxRepo: mockOutboxRepo,
    repoService: mockRepoService,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepoService.runInTransaction.mockImplementation(async (fn) =>
      fn(transaction)
    );
  });

  it('writes the acquisition, histories, and missing-rate outbox in one transaction', async () => {
    const effect = makeFxAcquisitionResult(null);
    const [lot, , lotAudit] = effect.lot;
    const [acquisition, , acquisitionAudit] = effect.acquisition;

    await service.persistAcquisition(effect, actor, { correlationId });

    expect(mockFxCostBasisLotRepo.create).toHaveBeenCalledWith(lot, {
      ...writeOptions,
      history: historyValue.make(lotAudit, actor, correlationId),
    });
    expect(mockFxCostBasisLotAcquisitionRepo.create).toHaveBeenCalledWith(
      acquisition,
      {
        ...writeOptions,
        history: historyValue.make(acquisitionAudit, actor, correlationId),
      }
    );
    expect(mockOutboxRepo.create).toHaveBeenCalledWith(
      {
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
      },
      writeOptions
    );
  });

  it('writes a rated acquisition without a missing-rate outbox row', async () => {
    await service.persistAcquisition(makeFxAcquisitionResult(), actor, {
      correlationId,
    });

    expect(mockFxCostBasisLotAcquisitionRepo.create).toHaveBeenCalled();
    expect(mockOutboxRepo.create).not.toHaveBeenCalled();
  });

  it('writes the disposition, versioned lots, allocations, and missing-rate outbox in one transaction', async () => {
    const effect = makeFxDispositionResult(null);
    const [[lot, , lotAudit]] = effect.lots;
    const [disposition, , dispositionAudit] = effect.disposition;
    const [allocation] = effect.allocations;

    await service.persistDisposition(effect, actor, {
      correlationId,
      tx: callerTransaction,
    });

    expect(mockRepoService.runInTransaction).toHaveBeenCalledWith(
      expect.any(Function),
      callerTransaction
    );
    expect(mockFxCostBasisLotRepo.update).toHaveBeenCalledWith(lot, {
      ...writeOptions,
      expectedVersion: lot.version - 1,
      history: historyValue.make(lotAudit, actor, correlationId),
    });
    expect(mockFxCostBasisLotDispositionRepo.create).toHaveBeenCalledWith(
      disposition,
      {
        ...writeOptions,
        history: historyValue.make(dispositionAudit, actor, correlationId),
      }
    );
    expect(
      mockFxCostBasisLotDispositionAllocationRepo.create
    ).toHaveBeenCalledWith(allocation, writeOptions);
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
      writeOptions
    );
  });

  it('writes the disposition allocations without recomputing domain aggregates', async () => {
    const effect = makeFxDispositionResult();
    const [allocation] = effect.allocations;
    const allocationWithDifferentQuantity = {
      ...allocation,
      quantity: moneyValue.make(9, SYSTEM_CURRENCIES.USD, false),
    };

    await service.persistDisposition(
      { ...effect, allocations: [allocationWithDifferentQuantity] },
      actor,
      { correlationId }
    );

    expect(
      mockFxCostBasisLotDispositionAllocationRepo.create
    ).toHaveBeenCalledWith(allocationWithDifferentQuantity, writeOptions);
    expect(mockOutboxRepo.create).not.toHaveBeenCalled();
  });

  it('writes reversed lots and histories in the caller transaction', async () => {
    const acquisition = makeFxAcquisitionResult();
    const [lot] = acquisition.lot;
    const reversal = fxCostBasisLotEntity.reverseAcquisition(
      lot,
      lot.remainingQuantity,
      lot.remainingCostBasis
    );
    const [reversedLot, , reversalAudit] = reversal;

    await service.persistReversal({ lots: [reversal] }, actor, {
      correlationId,
      tx: callerTransaction,
    });

    expect(mockRepoService.runInTransaction).toHaveBeenCalledWith(
      expect.any(Function),
      callerTransaction
    );
    expect(mockFxCostBasisLotRepo.update).toHaveBeenCalledWith(reversedLot, {
      ...writeOptions,
      expectedVersion: lot.version,
      history: historyValue.make(reversalAudit, actor, correlationId),
    });
  });
});
