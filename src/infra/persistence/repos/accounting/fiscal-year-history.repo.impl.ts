import IFiscalYearHistoryRepo from '@domain/accounting/repos/fiscal-year-history.repo';

import { fiscalYearHistoryInAudit } from '@infra/config/drizzle/schema';
import getDbQueryHelper from '@infra/persistence/helpers/get-db-query.helper';
import fiscalYearHistoryMapper from '@infra/persistence/repos/accounting/mappers/fiscal-year-history.mapper';

const fiscalYearHistoryRepo: IFiscalYearHistoryRepo = {
  save: async (fiscalYear, history, options) => {
    await getDbQueryHelper(options)
      .insert(fiscalYearHistoryInAudit)
      .values(fiscalYearHistoryMapper.toRepo(fiscalYear, history));
  },
};

export default fiscalYearHistoryRepo;
