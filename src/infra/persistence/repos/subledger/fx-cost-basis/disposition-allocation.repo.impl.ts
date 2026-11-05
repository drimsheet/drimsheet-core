import { eq } from 'drizzle-orm';

import IFxCostBasisLotDispositionAllocationRepo from '@domain/subledger/fx-cost-basis/repos/disposition-allocation.repo';

import { subledgerFxCostBasisLotDispositionAllocationsInCore } from '@infra/config/drizzle/schema';
import getDbQueryHelper from '@infra/persistence/helpers/get-db-query.helper';
import fxCostBasisLotDispositionAllocationMapper from '@infra/persistence/repos/subledger/fx-cost-basis/mappers/disposition-allocation.mapper';

const fxCostBasisLotDispositionAllocationRepo: IFxCostBasisLotDispositionAllocationRepo =
  {
    findAllByDispositionId: async (dispositionId, options) => {
      const results = await getDbQueryHelper(options)
        .select()
        .from(subledgerFxCostBasisLotDispositionAllocationsInCore)
        .where(
          eq(
            subledgerFxCostBasisLotDispositionAllocationsInCore.dispositionId,
            dispositionId
          )
        );

      return results.map(fxCostBasisLotDispositionAllocationMapper.toDomain);
    },

    create: async (payload, options) => {
      const repoModel =
        fxCostBasisLotDispositionAllocationMapper.toRepo(payload);
      await getDbQueryHelper(options)
        .insert(subledgerFxCostBasisLotDispositionAllocationsInCore)
        .values(repoModel);
    },
  };

export default fxCostBasisLotDispositionAllocationRepo;
