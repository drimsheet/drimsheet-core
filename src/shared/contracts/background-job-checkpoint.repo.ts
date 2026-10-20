import { IReadRepoOptions, IWriteRepoOptions } from '@shared/types/repo.types';

export const EBackgroundJob = {
  ExchangeRateIngestion: 'exchange-rate-ingestion',
} as const;

export type UBackgroundJob =
  (typeof EBackgroundJob)[keyof typeof EBackgroundJob];

export default interface IBackgroundJobCheckpointRepo {
  /** Read the last successful completion, or null if none exists. Storage failures reject. */
  getLastSucceededAt(
    jobKey: UBackgroundJob,
    options: IReadRepoOptions
  ): Promise<Date | null>;

  /** Record successful completion, joining a supplied transaction. Storage failures reject. */
  recordSuccess(
    jobKey: UBackgroundJob,
    options: IWriteRepoOptions
  ): Promise<void>;
}
