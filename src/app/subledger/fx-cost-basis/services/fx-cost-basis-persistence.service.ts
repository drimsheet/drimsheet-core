import {
  IRepoService,
  TRepoTransactionFn,
} from '@shared/contracts/repo.contract';
import { EOutboxType } from '@shared/types/outbox.types';
import { TEntityId } from '@shared/types/uuid';
import historyValue from '@shared/values/history/history.vo';

import IFxCostBasisLotAcquisitionRepo from '@domain/subledger/fx-cost-basis/repos/acquisition.repo';
import IFxCostBasisLotDispositionAllocationRepo from '@domain/subledger/fx-cost-basis/repos/disposition-allocation.repo';
import IFxCostBasisLotDispositionRepo from '@domain/subledger/fx-cost-basis/repos/disposition.repo';
import IFxCostBasisLotRepo from '@domain/subledger/fx-cost-basis/repos/lot.repo';
import { IFxCostBasisLotAcquisition } from '@domain/subledger/fx-cost-basis/types/acquisition.types';
import { IFxCostBasisLotDisposition } from '@domain/subledger/fx-cost-basis/types/disposition.types';

import IOutboxRepo from '@app/outbox/contracts/outbox.repo.contract';
import {
  EMissingOfficialFxRateEffectKind,
  IMissingOfficialFxRateOutbox,
  UMissingOfficialFxRateEffectKind,
} from '@app/outbox/types/missing-official-fx-rate.types';
import IFxCostBasisPersistenceAppService from '@app/subledger/fx-cost-basis/contracts/fx-cost-basis-persistence.service.contract';

interface IDependencies {
  lotRepo: IFxCostBasisLotRepo;
  acquisitionRepo: IFxCostBasisLotAcquisitionRepo;
  dispositionRepo: IFxCostBasisLotDispositionRepo;
  dispositionAllocationRepo: IFxCostBasisLotDispositionAllocationRepo;
  outboxRepo: IOutboxRepo;
  repoService: IRepoService;
}

function makeMissingOfficialRateOutbox(
  effect: IFxCostBasisLotAcquisition | IFxCostBasisLotDisposition,
  effectKind: UMissingOfficialFxRateEffectKind,
  effectiveDate: Date,
  actor: TEntityId,
  correlationId: string
): IMissingOfficialFxRateOutbox | null {
  if (effect.officialRate !== null) {
    return null;
  }

  return {
    id: effect.id,
    correlationId,
    type: EOutboxType.MissingOfficialFxRate,
    data: {
      effectKind,
      journalEntryId: effect.journalEntryId,
      accountingEntityId: effect.accountingEntityId,
      createdBy: actor,
      effectiveDate,
    },
  };
}

/** Writes the acquired lot, acquisition, their histories, and any missing-rate record together. */
function makePersistAcquisition(
  deps: IDependencies
): IFxCostBasisPersistenceAppService['persistAcquisition'] {
  return async (effect, actor, repoOptions) => {
    const { correlationId } = repoOptions;
    const [lot, , lotAudit] = effect.lot;
    const [acquisition, , acquisitionAudit] = effect.acquisition;
    const missingOfficialRateOutbox = makeMissingOfficialRateOutbox(
      acquisition,
      EMissingOfficialFxRateEffectKind.Acquisition,
      acquisition.acquisitionDate,
      actor,
      correlationId
    );

    const transactionFn: TRepoTransactionFn = async (tx) => {
      const writeOptions = { ...repoOptions, tx };

      await deps.lotRepo.create(lot, {
        ...writeOptions,
        history: historyValue.make(lotAudit, actor, correlationId),
      });
      await deps.acquisitionRepo.create(acquisition, {
        ...writeOptions,
        history: historyValue.make(acquisitionAudit, actor, correlationId),
      });

      if (missingOfficialRateOutbox) {
        await deps.outboxRepo.create(missingOfficialRateOutbox, writeOptions);
      }
    };

    await deps.repoService.runInTransaction(transactionFn, repoOptions.tx);
  };
}

/** Writes consumed lots, disposition, allocations, histories, and any missing-rate record together. */
function makePersistDisposition(
  deps: IDependencies
): IFxCostBasisPersistenceAppService['persistDisposition'] {
  return async (effect, actor, repoOptions) => {
    const { correlationId } = repoOptions;
    const { lots, allocations } = effect;
    const [disposition, , dispositionAudit] = effect.disposition;
    const missingOfficialRateOutbox = makeMissingOfficialRateOutbox(
      disposition,
      EMissingOfficialFxRateEffectKind.Disposition,
      disposition.dispositionDate,
      actor,
      correlationId
    );

    const transactionFn: TRepoTransactionFn = async (tx) => {
      const writeOptions = { ...repoOptions, tx };

      for (const [lot, , audit] of lots) {
        await deps.lotRepo.update(lot, {
          ...writeOptions,
          expectedVersion: lot.version - 1,
          history: historyValue.make(audit, actor, correlationId),
        });
      }
      await deps.dispositionRepo.create(disposition, {
        ...writeOptions,
        history: historyValue.make(dispositionAudit, actor, correlationId),
      });
      for (const allocation of allocations) {
        await deps.dispositionAllocationRepo.create(allocation, writeOptions);
      }

      if (missingOfficialRateOutbox) {
        await deps.outboxRepo.create(missingOfficialRateOutbox, writeOptions);
      }
    };

    await deps.repoService.runInTransaction(transactionFn, repoOptions.tx);
  };
}

/** Writes reversed lots and their histories together. */
function makePersistReversal(
  deps: IDependencies
): IFxCostBasisPersistenceAppService['persistReversal'] {
  return async (effect, actor, repoOptions) => {
    const { correlationId } = repoOptions;
    const transactionFn: TRepoTransactionFn = async (tx) => {
      const writeOptions = { ...repoOptions, tx };

      for (const [lot, , audit] of effect.lots) {
        await deps.lotRepo.update(lot, {
          ...writeOptions,
          expectedVersion: lot.version - 1,
          history: historyValue.make(audit, actor, correlationId),
        });
      }
    };

    await deps.repoService.runInTransaction(transactionFn, repoOptions.tx);
  };
}

export default function makeFxLotCostBasisPersistenceAppService(
  deps: IDependencies
): IFxCostBasisPersistenceAppService {
  return Object.freeze({
    persistAcquisition: makePersistAcquisition(deps),
    persistDisposition: makePersistDisposition(deps),
    persistReversal: makePersistReversal(deps),
  });
}
