export interface ICounterpartyArchiveReq {
  /** Version returned by the last read; stale writes fail with HTTP 409. */
  expectedVersion: number;
}
