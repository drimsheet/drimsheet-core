import makeFxCostBasisLotService from '@domain/subledger/fx-cost-basis/services/lot.service';

import makeFxLotCostBasisPersistenceAppService from '@app/subledger/fx-cost-basis/services/fx-cost-basis-persistence.service';

import outboxRepo from '@infra/persistence/repos/outbox';
import fxCostBasisLotAcquisitionRepo from '@infra/persistence/repos/subledger/fx-cost-basis/acquisition.repo.impl';
import fxCostBasisLotDispositionAllocationRepo from '@infra/persistence/repos/subledger/fx-cost-basis/disposition-allocation.repo.impl';
import fxCostBasisLotDispositionRepo from '@infra/persistence/repos/subledger/fx-cost-basis/disposition.repo.impl';
import fxCostBasisLotRepo from '@infra/persistence/repos/subledger/fx-cost-basis/lot.repo.impl';

import { repoService } from './repo';

export const fxCostBasisLotService = makeFxCostBasisLotService({
  lotRepo: fxCostBasisLotRepo,
  acquisitionRepo: fxCostBasisLotAcquisitionRepo,
  dispositionRepo: fxCostBasisLotDispositionRepo,
  dispositionAllocationRepo: fxCostBasisLotDispositionAllocationRepo,
});

export const fxCostBasisPersistenceAppService =
  makeFxLotCostBasisPersistenceAppService({
    lotRepo: fxCostBasisLotRepo,
    acquisitionRepo: fxCostBasisLotAcquisitionRepo,
    dispositionRepo: fxCostBasisLotDispositionRepo,
    dispositionAllocationRepo: fxCostBasisLotDispositionAllocationRepo,
    outboxRepo,
    repoService,
  });
