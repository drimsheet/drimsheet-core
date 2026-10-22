import deepFreeze from '@shared/utils/deep-freeze';
import stringUtils from '@shared/utils/string';
import periodValue from '@shared/values/interval/period.vo';
import { IPeriod } from '@shared/values/interval/types/interval.types';

import reportingPeriodValidation from '@domain/accounting/entities/validations/reporting-period.validation';
import periodError from '@domain/accounting/errors/period.error';
import reportingPeriodEvents from '@domain/accounting/events/reporting-period.events';
import {
  EReportingPeriodActions,
  TAuditedReportingPeriod,
} from '@domain/accounting/types/reporting-period-audit.types';
import {
  IReportingInterval,
  IReportingPeriod,
  IReportingPeriodMakePayload,
} from '@domain/accounting/types/reporting-period.types';
import reportingPeriodAudit from '@domain/accounting/values/reporting-period-audit.vo';

/** Adds domain identity metadata to a child of the shared calendar. */
function make(
  interval: Pick<
    IReportingInterval,
    'id' | 'accountingEntityId' | 'createdBy' | 'createdAt'
  >,
  payload: IReportingPeriodMakePayload
): TAuditedReportingPeriod {
  // Validate the supplied dates before copying, so coercion cannot admit them.
  periodValue.validateDateRange(payload.startDate, payload.endDate);

  const calendarPeriod: IPeriod = {
    id: payload.id,
    intervalId: interval.id,
    accountingEntityId: interval.accountingEntityId,
    ordinal: payload.ordinal,
    name: stringUtils.sanitizeAndValidate(
      payload.name,
      { min: 1, max: 100 },
      periodError.InvalidName
    ),
    startDate: new Date(payload.startDate),
    endDate: new Date(payload.endDate),
  };
  reportingPeriodValidation.validateCreation(calendarPeriod, interval);

  const period = deepFreeze<IReportingPeriod>({
    id: calendarPeriod.id,
    intervalId: calendarPeriod.intervalId,
    accountingEntityId: calendarPeriod.accountingEntityId,
    ordinal: calendarPeriod.ordinal,
    name: calendarPeriod.name,
    startDate: calendarPeriod.startDate,
    endDate: calendarPeriod.endDate,
    createdBy: interval.createdBy,
    createdAt: new Date(interval.createdAt),
    updatedAt: new Date(interval.createdAt),
  });
  const event = reportingPeriodEvents.created(period);
  const audit = reportingPeriodAudit.make({
    before: null,
    after: period,
    action: EReportingPeriodActions.Created,
  });

  return [period, [event], audit];
}

const reportingPeriodEntity = Object.freeze({
  make,
  ...reportingPeriodValidation,
});

export default reportingPeriodEntity;
