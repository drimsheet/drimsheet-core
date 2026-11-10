import { and, asc, eq } from 'drizzle-orm';

import validateVersionInRepoHelper from '@shared/helpers/validate-version-in-repo.helper';
import repoError from '@shared/values/errors/repo.error';

import IFxCostBasisLotRepo from '@domain/subledger/fx-cost-basis/repos/lot.repo';
import { EFxCostBasisLotStatus } from '@domain/subledger/fx-cost-basis/types/lot.types';

import {
  subledgerFxCostBasisLotHistoryInAudit,
  subledgerFxCostBasisLotsInCore,
} from '@infra/config/drizzle/schema';
import getDbQueryHelper from '@infra/persistence/helpers/get-db-query.helper';
import fxCostBasisLotHistoryMapper from '@infra/persistence/repos/subledger/fx-cost-basis/mappers/lot-history.mapper';
import fxCostBasisLotMapper from '@infra/persistence/repos/subledger/fx-cost-basis/mappers/lot.mapper';

const fxCostBasisLotRepo: IFxCostBasisLotRepo = {
  findById: async (id, options) => {
    const result = await getDbQueryHelper(options)
      .select()
      .from(subledgerFxCostBasisLotsInCore)
      .where(eq(subledgerFxCostBasisLotsInCore.id, id))
      .limit(1);

    return result[0] ? fxCostBasisLotMapper.toDomain(result[0]) : null;
  },

  findOpenByAccountId: async (accountingEntityId, ledgerAccountId, options) => {
    const results = await getDbQueryHelper(options)
      .select()
      .from(subledgerFxCostBasisLotsInCore)
      .where(
        and(
          eq(
            subledgerFxCostBasisLotsInCore.accountingEntityId,
            accountingEntityId
          ),
          eq(subledgerFxCostBasisLotsInCore.ledgerAccountId, ledgerAccountId),
          eq(subledgerFxCostBasisLotsInCore.status, EFxCostBasisLotStatus.Open)
        )
      )
      .orderBy(
        asc(subledgerFxCostBasisLotsInCore.acquisitionDate),
        asc(subledgerFxCostBasisLotsInCore.createdAt),
        asc(subledgerFxCostBasisLotsInCore.id)
      );
    return results.map(fxCostBasisLotMapper.toDomain);
  },

  create: async (payload, options) => {
    await getDbQueryHelper(options).transaction(async (tx) => {
      const repoModel = fxCostBasisLotMapper.toRepo(payload);
      await tx.insert(subledgerFxCostBasisLotsInCore).values(repoModel);

      const historyValues = Array.isArray(options.history)
        ? options.history
        : [options.history];
      await tx
        .insert(subledgerFxCostBasisLotHistoryInAudit)
        .values(historyValues.map(fxCostBasisLotHistoryMapper.toRepo));
    });
  },

  update: async (payload, options) => {
    validateVersionInRepoHelper(payload, options);

    await getDbQueryHelper(options).transaction(async (tx) => {
      const repoModel = fxCostBasisLotMapper.toRepo(payload);
      const updated = await tx
        .update(subledgerFxCostBasisLotsInCore)
        .set(repoModel)
        .where(
          and(
            eq(subledgerFxCostBasisLotsInCore.id, payload.id),
            eq(subledgerFxCostBasisLotsInCore.version, options.expectedVersion)
          )
        );

      if (updated.rowCount === 0) {
        throw new repoError.VersionNotFound({
          id: payload.id,
          version: options.expectedVersion,
        });
      }

      const historyValues = Array.isArray(options.history)
        ? options.history
        : [options.history];
      await tx
        .insert(subledgerFxCostBasisLotHistoryInAudit)
        .values(historyValues.map(fxCostBasisLotHistoryMapper.toRepo));
    });
  },
};

export default fxCostBasisLotRepo;
