import accountingContextQueryRepo from '@infra/persistence/repos/accounting/queries/accounting-context.query.repo.impl';
import nextCurrentAccountingPeriodQueryRepo from '@infra/persistence/repos/accounting/queries/next-current-accounting-period.query.repo.impl';
import reportingContextQueryRepo from '@infra/persistence/repos/accounting/queries/reporting-context.query.repo.impl';

import accountingContextHistoryRepo from './accounting-context-history.repo.impl';
import accountingContextRepo from './accounting-context.repo.impl';
import accountingEntityHistoryRepo from './accounting-entity-history.repo.impl';
import accountingEntityRepo from './accounting-entity.repo.impl';
import accountingPeriodHistoryRepo from './accounting-period-history.repo.impl';
import accountingPeriodRepo from './accounting-period.repo.impl';
import accountingStandardsRepo from './accounting-standards.repo.impl';
import fiscalYearHistoryRepo from './fiscal-year-history.repo.impl';
import fiscalYearRepo from './fiscal-year.repo.impl';
import jurisdictionAccountingStandardRepo from './jurisdiction-accounting-standard.repo.impl';
import jurisdictionRepo from './jurisdiction.repo.impl';
import reportingContextHistoryRepo from './reporting-context-history.repo.impl';
import reportingContextRepo from './reporting-context.repo.impl';
import reportingPeriodHistoryRepo from './reporting-period-history.repo.impl';
import reportingPeriodRepo from './reporting-period.repo.impl';

const accountingRepos = {
  nextCurrentAccountingPeriodQuery: nextCurrentAccountingPeriodQueryRepo,
  accountingContextQuery: accountingContextQueryRepo,
  accountingContext: accountingContextRepo,
  accountingContextHistory: accountingContextHistoryRepo,
  accountingEntity: accountingEntityRepo,
  accountingEntityHistory: accountingEntityHistoryRepo,
  accountingPeriod: accountingPeriodRepo,
  accountingPeriodHistory: accountingPeriodHistoryRepo,
  accountingStandards: accountingStandardsRepo,
  fiscalYear: fiscalYearRepo,
  fiscalYearHistory: fiscalYearHistoryRepo,
  jurisdiction: jurisdictionRepo,
  jurisdictionAccountingStandard: jurisdictionAccountingStandardRepo,
  reportingContext: reportingContextRepo,
  reportingContextQuery: reportingContextQueryRepo,
  reportingContextHistory: reportingContextHistoryRepo,
  reportingPeriod: reportingPeriodRepo,
  reportingPeriodHistory: reportingPeriodHistoryRepo,
};

export default accountingRepos;
