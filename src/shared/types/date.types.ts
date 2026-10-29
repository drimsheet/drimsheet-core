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

export interface IStartAndEndDates {
  start: Date;
  end: Date;
}
