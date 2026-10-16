import { and, eq, isNull } from 'drizzle-orm';

import IAccountingContextQueryRepo from '@app/accounting/contracts/accounting-context.query.repo.contract';

import {
  accountingContextsInCore,
  accountingPeriodsInCore,
} from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import accountingContextDetailsMapper from '@infra/persistence/repos/accounting/mappers/accounting-context-details.mapper';

const accountingContextQueryRepo: IAccountingContextQueryRepo = {
  async findActiveByAccountingEntityId(accountingEntityId, options) {
    const contexts = await getDbQuery(
      options
    ).query.accountingContextsInCore.findMany({
      where: and(
        eq(accountingContextsInCore.accountingEntityId, accountingEntityId),
        isNull(accountingContextsInCore.closedAt)
      ),
      with: {
        fiscalYearsInCore: {
          with: {
            accountingPeriodsInCores: {
              where: eq(
                accountingPeriodsInCore.accountingEntityId,
                accountingEntityId
              ),
              orderBy: [
                accountingPeriodsInCore.startDate,
                accountingPeriodsInCore.id,
              ],
            },
          },
        },
      },
      orderBy: [
        accountingContextsInCore.createdAt,
        accountingContextsInCore.id,
      ],
    });

    return contexts.map(accountingContextDetailsMapper.toDetails);
  },
};

export default accountingContextQueryRepo;
