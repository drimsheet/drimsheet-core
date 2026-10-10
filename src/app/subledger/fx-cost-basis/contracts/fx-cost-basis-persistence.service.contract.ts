import { IWriteRepoOptions } from '@shared/types/repo.types';

import {
  IFxCostBasisLotAcquisition,
  IFxCostBasisLotAcquisitionHistory,
} from '@domain/subledger/fx-cost-basis/types/acquisition.types';
import {
  IFxCostBasisLotDisposition,
  IFxCostBasisLotDispositionAllocation,
  IFxCostBasisLotDispositionHistory,
} from '@domain/subledger/fx-cost-basis/types/disposition.types';
import {
  IFxCostBasisLot,
  IFxCostBasisLotHistory,
} from '@domain/subledger/fx-cost-basis/types/lot.types';

import { IMissingOfficialFxRateOutbox } from '@app/outbox/types/missing-official-fx-rate.types';

interface IFxCostBasisLotWithHistory {
  lot: IFxCostBasisLot;
  history: IFxCostBasisLotHistory;
  expectedVersion: number;
}

export interface IFxCostBasisAcquisitionPersistencePayload {
  lot: IFxCostBasisLot;
  acquisition: IFxCostBasisLotAcquisition;
  lotHistory: IFxCostBasisLotHistory;
  acquisitionHistory: IFxCostBasisLotAcquisitionHistory;
  missingOfficialRateOutbox: IMissingOfficialFxRateOutbox | null;
}

export interface IFxCostBasisDispositionPersistencePayload {
  lots: IFxCostBasisLotWithHistory[];
  disposition: IFxCostBasisLotDisposition;
  dispositionHistory: IFxCostBasisLotDispositionHistory;
  allocations: IFxCostBasisLotDispositionAllocation[];
  missingOfficialRateOutbox: IMissingOfficialFxRateOutbox | null;
}

export interface IFxCostBasisReversalPersistencePayload {
  lots: IFxCostBasisLotWithHistory[];
}

export default interface IFxCostBasisPersistenceAppService {
  /**
   * Atomically writes a prepared acquisition bundle, joining the supplied
   * transaction when present.
   */
  persistAcquisition(
    payload: IFxCostBasisAcquisitionPersistencePayload,
    repoOptions: IWriteRepoOptions
  ): Promise<void>;

  /**
   * Atomically writes a prepared disposition bundle, joining the supplied
   * transaction when present.
   */
  persistDisposition(
    payload: IFxCostBasisDispositionPersistencePayload,
    repoOptions: IWriteRepoOptions
  ): Promise<void>;

  persistReversal(
    payload: IFxCostBasisReversalPersistencePayload,
    repoOptions: IWriteRepoOptions
  ): Promise<void>;
}
