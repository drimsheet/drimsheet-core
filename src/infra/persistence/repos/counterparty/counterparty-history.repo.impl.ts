import ICounterpartyHistoryRepo from '@domain/counterparty/repos/counterparty-history.repo';

import { counterpartyHistoryInAudit } from '@infra/config/drizzle/schema';
import getDbQueryHelper from '@infra/persistence/helpers/get-db-query.helper';
import counterpartyHistoryMapper from '@infra/persistence/repos/counterparty/mappers/counterparty-history.mapper';

const counterpartyHistoryRepo: ICounterpartyHistoryRepo = {
  save: async (counterparty, history, options) => {
    await getDbQueryHelper(options)
      .insert(counterpartyHistoryInAudit)
      .values(counterpartyHistoryMapper.toRepo(counterparty, history));
  },
};

export default counterpartyHistoryRepo;
