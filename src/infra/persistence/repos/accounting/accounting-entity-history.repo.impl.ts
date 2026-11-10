import IAccountingEntityHistoryRepo from '@domain/accounting/repos/accounting-entity-history.repo';

import { accountingEntityHistoryInAudit } from '@infra/config/drizzle/schema';
import getDbQueryHelper from '@infra/persistence/helpers/get-db-query.helper';
import accountingEntityHistoryMapper from '@infra/persistence/repos/accounting/mappers/accounting-entity-history.mapper';

const accountingEntityHistoryRepo: IAccountingEntityHistoryRepo = {
  save: async (entity, history, options) => {
    await getDbQueryHelper(options)
      .insert(accountingEntityHistoryInAudit)
      .values(accountingEntityHistoryMapper.toRepo(history));
  },
};

export default accountingEntityHistoryRepo;
