import { IWriteRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import {
  IFxCostBasisAcquisitionResult,
  IFxCostBasisDispositionResult,
  IFxCostBasisReversalResult,
} from '@domain/subledger/fx-cost-basis/types/lot.service.types';

/** Writes each FX domain result atomically, joining the caller's transaction. */
export default interface IFxCostBasisPersistenceAppService {
  persistAcquisition(
    acquisition: IFxCostBasisAcquisitionResult,
    actor: TEntityId,
    repoOptions: IWriteRepoOptions
  ): Promise<void>;

  persistDisposition(
    disposition: IFxCostBasisDispositionResult,
    actor: TEntityId,
    repoOptions: IWriteRepoOptions
  ): Promise<void>;

  persistReversal(
    reversal: IFxCostBasisReversalResult,
    actor: TEntityId,
    repoOptions: IWriteRepoOptions
  ): Promise<void>;
}
