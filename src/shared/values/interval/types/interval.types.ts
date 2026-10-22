import { UCalendarUnits } from '@shared/types/date.types';
import { TEntityId } from '@shared/types/uuid';

export interface IPeriod {
  id: TEntityId;
  intervalId: TEntityId;
  accountingEntityId: TEntityId;
  ordinal: number;
  name: string;
  /** Inclusive start instant. */
  startDate: Date;
  /** Exclusive end instant, shared with the following period's start. */
  endDate: Date;
}

export interface IPeriodMakePayload extends Pick<IPeriod, 'name'> {}

export interface IInterval {
  id: TEntityId;
  accountingEntityId: TEntityId;
  unit: UCalendarUnits;
  /** Total number of periods, not the number of units per period. */
  count: number;
  /** Inclusive start instant. */
  startDate: Date;
  /** Exclusive end instant. */
  endDate: Date;
  currentPeriodOrdinal: number;
  nextPeriodStartDate: Date | null;
  periods: IPeriod[];
}

export interface IIntervalMakePayload extends Pick<
  IInterval,
  'accountingEntityId' | 'unit' | 'count' | 'startDate' | 'endDate'
> {
  periods: IPeriodMakePayload[];
}
