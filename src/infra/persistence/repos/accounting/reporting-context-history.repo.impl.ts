import IReportingContextHistoryRepo from '@domain/accounting/repos/reporting-context-history.repo';

import { reportingContextHistoryInAudit } from '@infra/config/drizzle/schema';
import getDbQueryHelper from '@infra/persistence/helpers/get-db-query.helper';
import reportingContextHistoryMapper from '@infra/persistence/repos/accounting/mappers/reporting-context-history.mapper';

const reportingContextHistoryRepo: IReportingContextHistoryRepo = {
  save: async (context, history, options) => {
    await getDbQueryHelper(options)
      .insert(reportingContextHistoryInAudit)
      .values(reportingContextHistoryMapper.toRepo(context, history));
  },
};

export default reportingContextHistoryRepo;
