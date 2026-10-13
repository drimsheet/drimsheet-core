import IJurisdictionRepo from '@domain/accounting/repos/jurisdiction.repo';

import { jurisdictionsInCore } from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import jurisdictionMapper from '@infra/persistence/repos/accounting/mappers/jurisdiction.mapper';

const jurisdictionRepo: IJurisdictionRepo = {
  create: async (domain, createdBy, options) => {
    const query = getDbQuery(options);

    const values = Array.isArray(domain)
      ? domain.map((value) => jurisdictionMapper.toRepo(value, createdBy))
      : [jurisdictionMapper.toRepo(domain, createdBy)];

    if (values.length === 0) {
      return;
    }

    await query
      .insert(jurisdictionsInCore)
      .values(values)
      .onConflictDoNothing();
  },
};

export default jurisdictionRepo;
