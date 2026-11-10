import { eq } from 'drizzle-orm';

import IFxCostBasisLotAcquisitionRepo from '@domain/subledger/fx-cost-basis/repos/acquisition.repo';

import {
  subledgerFxCostBasisLotAcquisitionHistoryInAudit,
  subledgerFxCostBasisLotAcquisitionsInCore,
} from '@infra/config/drizzle/schema';
import getDbQueryHelper from '@infra/persistence/helpers/get-db-query.helper';
import fxCostBasisLotAcquisitionHistoryMapper from '@infra/persistence/repos/subledger/fx-cost-basis/mappers/acquisition-history.mapper';
import fxCostBasisLotAcquisitionMapper from '@infra/persistence/repos/subledger/fx-cost-basis/mappers/acquisition.mapper';

const fxCostBasisLotAcquisitionRepo: IFxCostBasisLotAcquisitionRepo = {
  findByJournalEntryId: async (journalEntryId, options) => {
    const result = await getDbQueryHelper(options)
      .select()
      .from(subledgerFxCostBasisLotAcquisitionsInCore)
      .where(
        eq(
          subledgerFxCostBasisLotAcquisitionsInCore.journalEntryId,
          journalEntryId
        )
      )
      .limit(1);

    return result[0]
      ? fxCostBasisLotAcquisitionMapper.toDomain(result[0])
      : null;
  },

  create: async (payload, options) => {
    await getDbQueryHelper(options).transaction(async (tx) => {
      const repoModel = fxCostBasisLotAcquisitionMapper.toRepo(payload);
      await tx
        .insert(subledgerFxCostBasisLotAcquisitionsInCore)
        .values(repoModel);

      const historyValues = Array.isArray(options.history)
        ? options.history
        : [options.history];
      await tx
        .insert(subledgerFxCostBasisLotAcquisitionHistoryInAudit)
        .values(
          historyValues.map(fxCostBasisLotAcquisitionHistoryMapper.toRepo)
        );
    });
  },
};

export default fxCostBasisLotAcquisitionRepo;
