import { eq, sql } from 'drizzle-orm';

import IBackgroundJobCheckpointRepo from '@shared/contracts/background-job-checkpoint.repo';

import { backgroundJobCheckpointsInCore } from '@infra/config/drizzle/schema';
import { fromRepoDate } from '@infra/persistence/helpers/date.mapper';
import getDbQuery from '@infra/persistence/helpers/get-db-query';

const backgroundJobCheckpointRepo: IBackgroundJobCheckpointRepo = {
  async getLastSucceededAt(jobKey, options) {
    const [checkpoint] = await getDbQuery(options)
      .select({
        lastSucceededAt: backgroundJobCheckpointsInCore.lastSucceededAt,
      })
      .from(backgroundJobCheckpointsInCore)
      .where(eq(backgroundJobCheckpointsInCore.jobKey, jobKey))
      .limit(1);

    return checkpoint ? fromRepoDate(checkpoint.lastSucceededAt) : null;
  },

  async recordSuccess(jobKey, options) {
    await getDbQuery(options)
      .insert(backgroundJobCheckpointsInCore)
      .values({ jobKey, lastSucceededAt: sql`clock_timestamp()` })
      .onConflictDoUpdate({
        target: backgroundJobCheckpointsInCore.jobKey,
        set: { lastSucceededAt: sql`clock_timestamp()` },
      });
  },
};

export default backgroundJobCheckpointRepo;
