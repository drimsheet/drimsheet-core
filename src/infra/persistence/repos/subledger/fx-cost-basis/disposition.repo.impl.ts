import { eq } from 'drizzle-orm';

import IFxCostBasisLotDispositionRepo from '@domain/subledger/fx-cost-basis/repos/disposition.repo';

import {
  subledgerFxCostBasisLotDispositionHistoryInAudit,
  subledgerFxCostBasisLotDispositionsInCore,
} from '@infra/config/drizzle/schema';
import getDbQueryHelper from '@infra/persistence/helpers/get-db-query.helper';
import fxCostBasisLotDispositionHistoryMapper from '@infra/persistence/repos/subledger/fx-cost-basis/mappers/disposition-history.mapper';
import fxCostBasisLotDispositionMapper from '@infra/persistence/repos/subledger/fx-cost-basis/mappers/disposition.mapper';

const fxCostBasisLotDispositionRepo: IFxCostBasisLotDispositionRepo = {
  findByJournalEntryId: async (journalEntryId, options) => {
    const result = await getDbQueryHelper(options)
      .select()
      .from(subledgerFxCostBasisLotDispositionsInCore)
      .where(
        eq(
          subledgerFxCostBasisLotDispositionsInCore.journalEntryId,
          journalEntryId
        )
      )
      .limit(1);

    return result[0]
      ? fxCostBasisLotDispositionMapper.toDomain(result[0])
      : null;
  },

  create: async (payload, options) => {
    await getDbQueryHelper(options).transaction(async (tx) => {
      const repoModel = fxCostBasisLotDispositionMapper.toRepo(payload);
      await tx
        .insert(subledgerFxCostBasisLotDispositionsInCore)
        .values(repoModel);

      await tx
        .insert(subledgerFxCostBasisLotDispositionHistoryInAudit)
        .values(fxCostBasisLotDispositionHistoryMapper.toRepo(options.history));
    });
  },
};

export default fxCostBasisLotDispositionRepo;
