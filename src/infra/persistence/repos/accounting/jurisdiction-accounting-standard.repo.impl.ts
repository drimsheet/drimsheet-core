import IJurisdictionAccountingStandardRepo from '@domain/accounting/repos/jurisdiction-accounting-standard.repo';

import { jurisdictionAccountingStandardsInCore } from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import jurisdictionAccountingStandardMapper from '@infra/persistence/repos/accounting/mappers/jurisdiction-accounting-standard.mapper';

const jurisdictionAccountingStandardRepo: IJurisdictionAccountingStandardRepo =
  {
    create: async (domain, options) => {
      const query = getDbQuery(options);

      const values = Array.isArray(domain)
        ? domain.map(jurisdictionAccountingStandardMapper.toRepo)
        : [jurisdictionAccountingStandardMapper.toRepo(domain)];

      if (values.length === 0) {
        return;
      }

      await query
        .insert(jurisdictionAccountingStandardsInCore)
        .values(values)
        .onConflictDoNothing();
    },
  };

export default jurisdictionAccountingStandardRepo;
