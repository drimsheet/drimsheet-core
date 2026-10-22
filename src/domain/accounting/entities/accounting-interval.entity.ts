import dateUtils from '@shared/utils/date';
import deepFreeze from '@shared/utils/deep-freeze';
import { IEvent } from '@shared/values/events/types/event.types';
import intervalValue from '@shared/values/interval/interval.vo';

import getSharedIntervalUnitHelper from '@domain/accounting/entities/helpers/get-shared-interval-unit.helper';
import accountingIntervalValidation from '@domain/accounting/entities/validations/accounting-interval.validation';
import accountingIntervalEvents from '@domain/accounting/events/accounting-interval.events';
import {
  EAccountingIntervalActions,
  IAccountingIntervalAudit,
  TAuditedAccountingInterval,
} from '@domain/accounting/types/accounting-period-audit.types';
import {
  IAccountingInterval,
  IAccountingIntervalMakePayload,
} from '@domain/accounting/types/accounting-period.types';
import accountingIntervalAudit from '@domain/accounting/values/accounting-interval-audit.vo';

import accountingPeriodEntity from './accounting-period.entity';

/** Creates the calendar and gathers its child events and audits. */
function make(
  payload: IAccountingIntervalMakePayload,
  currentDate: Date = dateUtils.now()
): TAuditedAccountingInterval {
  accountingIntervalValidation.validateCreation(payload);

  const calendar = intervalValue.make(
    { ...payload, unit: getSharedIntervalUnitHelper(payload.unit) },
    currentDate
  );

  const timestamp = dateUtils.now();

  const periodParent = {
    id: calendar.id,
    accountingEntityId: calendar.accountingEntityId,
    createdBy: payload.createdBy,
    createdAt: timestamp,
  };
  const periodsWithEvents = calendar.periods.map((period) =>
    accountingPeriodEntity.make(periodParent, period)
  );

  const periods = periodsWithEvents.map(([period]) => period);

  const interval = deepFreeze<IAccountingInterval>({
    id: calendar.id,
    accountingEntityId: calendar.accountingEntityId,
    fiscalYearId: payload.fiscalYearId,
    unit: payload.unit,
    count: calendar.count,
    startDate: calendar.startDate,
    endDate: calendar.endDate,
    currentPeriodOrdinal: calendar.currentPeriodOrdinal,
    nextPeriodStartDate: calendar.nextPeriodStartDate,
    periods,
    createdBy: payload.createdBy,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const event = accountingIntervalEvents.created(interval);
  const audit = accountingIntervalAudit.make({
    before: null,
    after: interval,
    action: EAccountingIntervalActions.Created,
  });
  const periodEvents = periodsWithEvents.flatMap(([, events]) => events);
  const periodAudits = periodsWithEvents.map(
    ([, , periodAudit]) => periodAudit
  );

  return [
    interval,
    [event, ...periodEvents],
    { interval: audit, periods: periodAudits },
  ];
}

/** Changes selection without changing child periods or their lifecycle. */
function updateCurrentPeriod(
  interval: IAccountingInterval,
  currentDate: Date = dateUtils.now()
): [
  IAccountingInterval,
  IEvent<IAccountingInterval>[],
  IAccountingIntervalAudit | null,
] {
  accountingIntervalValidation.validate(interval);

  const calendar = intervalValue.updateCurrentPeriod(
    { ...interval, unit: getSharedIntervalUnitHelper(interval.unit) },
    currentDate
  );

  if (calendar.currentPeriodOrdinal === interval.currentPeriodOrdinal) {
    return [interval, [], null];
  }

  const updatedInterval = deepFreeze<IAccountingInterval>({
    id: interval.id,
    accountingEntityId: interval.accountingEntityId,
    fiscalYearId: interval.fiscalYearId,
    unit: interval.unit,
    count: interval.count,
    startDate: interval.startDate,
    endDate: interval.endDate,
    currentPeriodOrdinal: calendar.currentPeriodOrdinal,
    nextPeriodStartDate: calendar.nextPeriodStartDate,
    periods: interval.periods,
    createdBy: interval.createdBy,
    createdAt: interval.createdAt,
    updatedAt: dateUtils.now(),
  });

  const event = accountingIntervalEvents.updated(updatedInterval);
  const audit = accountingIntervalAudit.make({
    before: interval,
    after: updatedInterval,
    action: EAccountingIntervalActions.Updated,
  });

  return [updatedInterval, [event], audit];
}

const accountingIntervalEntity = Object.freeze({
  make,
  updateCurrentPeriod,

  ...accountingIntervalValidation,
});

export default accountingIntervalEntity;
