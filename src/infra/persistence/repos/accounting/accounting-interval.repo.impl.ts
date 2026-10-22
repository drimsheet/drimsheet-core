import { and, asc, eq } from 'drizzle-orm';

import IAccountingIntervalRepo from '@domain/accounting/repos/accounting-interval.repo';

import {
  accountingIntervalsInCore,
  accountingPeriodsInCore,
} from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import accountingIntervalMapper from '@infra/persistence/repos/accounting/mappers/accounting-interval.mapper';

const accountingIntervalRepo: IAccountingIntervalRepo = {
  async findById(accountingEntityId, id, options) {
    const interval = await getDbQuery(
      options
    ).query.accountingIntervalsInCore.findFirst({
      where: and(
        eq(accountingIntervalsInCore.id, id),
        eq(accountingIntervalsInCore.accountingEntityId, accountingEntityId)
      ),
      with: {
        accountingPeriodsInCores: {
          orderBy: asc(accountingPeriodsInCore.ordinal),
        },
      },
    });

    return interval ? accountingIntervalMapper.toDomain(interval) : null;
  },
};

export default accountingIntervalRepo;
