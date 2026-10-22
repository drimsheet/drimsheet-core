import dateUtils from '@shared/utils/date';
import deepFreeze from '@shared/utils/deep-freeze';
import { IEvent } from '@shared/values/events/types/event.types';
import intervalValue from '@shared/values/interval/interval.vo';

import getSharedIntervalUnitHelper from '@domain/accounting/entities/helpers/get-shared-interval-unit.helper';
import reportingIntervalValidation from '@domain/accounting/entities/validations/reporting-interval.validation';
import reportingIntervalEvents from '@domain/accounting/events/reporting-interval.events';
import {
  EReportingIntervalActions,
  IReportingIntervalAudit,
  TAuditedReportingInterval,
} from '@domain/accounting/types/reporting-period-audit.types';
import {
  IReportingInterval,
  IReportingIntervalMakePayload,
} from '@domain/accounting/types/reporting-period.types';
import reportingIntervalAudit from '@domain/accounting/values/reporting-interval-audit.vo';

import reportingPeriodEntity from './reporting-period.entity';

/** Creates the calendar and gathers its child events and audits. */
function make(
  payload: IReportingIntervalMakePayload,
  currentDate: Date = dateUtils.now()
): TAuditedReportingInterval {
  reportingIntervalValidation.validateCreation(payload);
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
    reportingPeriodEntity.make(periodParent, period)
  );
  const periods = periodsWithEvents.map(([period]) => period);
  const interval = deepFreeze<IReportingInterval>({
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
  const event = reportingIntervalEvents.created(interval);
  const audit = reportingIntervalAudit.make({
    before: null,
    after: interval,
    action: EReportingIntervalActions.Created,
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
  interval: IReportingInterval,
  currentDate: Date = dateUtils.now()
): [
  IReportingInterval,
  IEvent<IReportingInterval>[],
  IReportingIntervalAudit | null,
] {
  reportingIntervalValidation.validate(interval);
  const calendar = intervalValue.updateCurrentPeriod(
    { ...interval, unit: getSharedIntervalUnitHelper(interval.unit) },
    currentDate
  );
  if (calendar.currentPeriodOrdinal === interval.currentPeriodOrdinal) {
    return [interval, [], null];
  }

  const updatedInterval = deepFreeze<IReportingInterval>({
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
  const event = reportingIntervalEvents.updated(updatedInterval);
  const audit = reportingIntervalAudit.make({
    before: interval,
    after: updatedInterval,
    action: EReportingIntervalActions.Updated,
  });

  return [updatedInterval, [event], audit];
}

const reportingIntervalEntity = Object.freeze({
  make,
  updateCurrentPeriod,
  ...reportingIntervalValidation,
});

export default reportingIntervalEntity;
