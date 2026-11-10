import { eq, sql } from 'drizzle-orm';

import IBackgroundJobCheckpointRepo from '@shared/contracts/background-job-checkpoint.repo';

import { backgroundJobCheckpointsInCore } from '@infra/config/drizzle/schema';
import { fromRepoDate } from '@infra/persistence/helpers/date.mapper';
import getDbQueryHelper from '@infra/persistence/helpers/get-db-query.helper';

const backgroundJobCheckpointRepo: IBackgroundJobCheckpointRepo = {
  async getLastSucceededAt(jobKey, options) {
    const [checkpoint] = await getDbQueryHelper(options)
      .select({
        lastSucceededAt: backgroundJobCheckpointsInCore.lastSucceededAt,
      })
      .from(backgroundJobCheckpointsInCore)
      .where(eq(backgroundJobCheckpointsInCore.jobKey, jobKey))
      .limit(1);

    return checkpoint ? fromRepoDate(checkpoint.lastSucceededAt) : null;
  },

  async recordSuccess(jobKey, options) {
    await getDbQueryHelper(options)
      .insert(backgroundJobCheckpointsInCore)
      .values({ jobKey, lastSucceededAt: sql`clock_timestamp()` })
      .onConflictDoUpdate({
        target: backgroundJobCheckpointsInCore.jobKey,
        set: { lastSucceededAt: sql`clock_timestamp()` },
      });
  },
};

export default backgroundJobCheckpointRepo;
