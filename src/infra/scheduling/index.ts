import currentAccountingPeriodJob from './current-accounting-period.job';
import currentReportingPeriodJob from './current-reporting-period.job';
import exchangeRateIngestionJob from './exchange-rate-ingestion.job';

/** Job initializers register stopped tasks with node-cron. */
export default Object.freeze([
  exchangeRateIngestionJob,
  currentAccountingPeriodJob,
  currentReportingPeriodJob,
]);
