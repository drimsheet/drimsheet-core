import IActorHistoryRepo from '@domain/user/repos/actor-history.repo';

import { actorHistoryInAudit } from '@infra/config/drizzle/schema';
import getDbQueryHelper from '@infra/persistence/helpers/get-db-query.helper';
import actorHistoryMapper from '@infra/persistence/repos/user/mappers/actor-history.mapper';

const actorHistoryRepo: IActorHistoryRepo = {
  save: async (history, options) => {
    await getDbQueryHelper(options)
      .insert(actorHistoryInAudit)
      .values(actorHistoryMapper.toRepo(history));
  },
};

export default actorHistoryRepo;
