import deepFreeze from '@shared/utils/deep-freeze';
import stringUtils from '@shared/utils/string';
import periodValue from '@shared/values/interval/period.vo';
import { IPeriod } from '@shared/values/interval/types/interval.types';

import accountingPeriodValidation from '@domain/accounting/entities/validations/accounting-period.validation';
import periodError from '@domain/accounting/errors/period.error';
import accountingPeriodEvents from '@domain/accounting/events/accounting-period.events';
import {
  EAccountingPeriodActions,
  TAuditedAccountingPeriod,
} from '@domain/accounting/types/accounting-period-audit.types';
import {
  EAccountingPeriodStatus,
  IAccountingInterval,
  IAccountingPeriod,
  IAccountingPeriodMakePayload,
} from '@domain/accounting/types/accounting-period.types';
import accountingPeriodAudit from '@domain/accounting/values/accounting-period-audit.vo';

/** Adds domain identity metadata to a child of the shared calendar. */
function make(
  interval: Pick<
    IAccountingInterval,
    'id' | 'accountingEntityId' | 'createdBy' | 'createdAt'
  >,
  payload: IAccountingPeriodMakePayload
): TAuditedAccountingPeriod {
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
  accountingPeriodValidation.validateCreation(calendarPeriod, interval);

  const period = deepFreeze<IAccountingPeriod>({
    id: calendarPeriod.id,
    intervalId: calendarPeriod.intervalId,
    accountingEntityId: calendarPeriod.accountingEntityId,
    ordinal: calendarPeriod.ordinal,
    name: calendarPeriod.name,
    startDate: calendarPeriod.startDate,
    endDate: calendarPeriod.endDate,
    status: EAccountingPeriodStatus.Open,
    closedAt: null,
    createdBy: interval.createdBy,
    createdAt: new Date(interval.createdAt),
    updatedAt: new Date(interval.createdAt),
  });
  const event = accountingPeriodEvents.created(period);
  const audit = accountingPeriodAudit.make({
    before: null,
    after: period,
    action: EAccountingPeriodActions.Created,
  });

  return [period, [event], audit];
}

const accountingPeriodEntity = Object.freeze({
  make,
  ...accountingPeriodValidation,
});

export default accountingPeriodEntity;
