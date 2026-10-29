/**
 * Inclusive range of instants. Neither boundary is normalized.
 * Values constructed by dateRangeValue return defensive Date copies.
 */
export interface IDateRange {
  readonly from: Date;
  readonly to: Date;
}

/** Inclusive filter bounds; absent boundaries leave that side unrestricted. */
export type IOpenDateRange = Partial<IDateRange>;
