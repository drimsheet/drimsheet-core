export const ECalendarUnits = {
  Second: 'second',
  Minute: 'minute',
  Hour: 'hour',
  Day: 'day',
  Week: 'week',
  Month: 'month',
  Year: 'year',
} as const;

export type UCalendarUnits =
  (typeof ECalendarUnits)[keyof typeof ECalendarUnits];

/** Inclusive calendar-date range with boundaries normalized to UTC midnight. */
export interface IDateRange {
  from: Date;
  to: Date;
}

export interface IStartAndEndDates {
  start: Date;
  end: Date;
}
