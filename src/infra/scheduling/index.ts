import exchangeRateIngestionJob from './exchange-rate-ingestion.job';

/** Job initializers register stopped tasks with node-cron. */
export default Object.freeze([exchangeRateIngestionJob]);
