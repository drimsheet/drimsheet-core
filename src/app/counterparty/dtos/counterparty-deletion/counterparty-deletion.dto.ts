export interface ICounterpartyDeletionReq {
  /** Version returned by the last read; stale deletes fail with HTTP 409. */
  expectedVersion: number;
}
