import IUserHistoryRepo from '@domain/user/repos/user-history.repo';

import { userProfileHistoryInAudit } from '@infra/config/drizzle/schema';
import getDbQueryHelper from '@infra/persistence/helpers/get-db-query.helper';
import userHistoryMapper from '@infra/persistence/repos/user/mappers/user-history.mapper';

const userHistoryRepo: IUserHistoryRepo = {
  save: async (history, options) => {
    await getDbQueryHelper(options)
      .insert(userProfileHistoryInAudit)
      .values(userHistoryMapper.toRepo(history));
  },
};

export default userHistoryRepo;
