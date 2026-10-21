import dateUtils from '@shared/utils/date';
import deepFreeze from '@shared/utils/deep-freeze';
import stringUtils from '@shared/utils/string';
import { TAuditedEntity } from '@shared/values/events/types/event.types';

import getCalendarPeriodIntervalsHelper from '@domain/accounting/entities/helpers/get-calendar-period-intervals.helper';
import accountingPeriodValidation from '@domain/accounting/entities/validations/accounting-period.validation';
import periodError from '@domain/accounting/errors/period.error';
import periodEvents from '@domain/accounting/events/period.events';
import { IFiscalYear } from '@domain/accounting/types/fiscal-year.types';
import { EPeriodActions } from '@domain/accounting/types/period-audit.types';
import {
  EPeriodStatus,
  IAccountingPeriod,
} from '@domain/accounting/types/period.types';
import accountingPeriodAudit from '@domain/accounting/values/accounting-period-audit.vo';

interface IMakePayload extends Pick<
  IAccountingPeriod,
  'createdBy' | 'accountingEntityId' | 'unit' | 'count'
> {
  fiscalYear: IFiscalYear;
}

function make(
  payload: IMakePayload
): TAuditedEntity<IAccountingPeriod, IAccountingPeriod, IAccountingPeriod>[] {
  stringUtils.validateUUID(
    payload.accountingEntityId,
    periodError.InvalidAccountingEntityId
  );
  stringUtils.validateUUID(
    payload.fiscalYear.id,
    periodError.InvalidFiscalYearId
  );
  stringUtils.validateUUID(payload.createdBy, periodError.InvalidCreatedBy);
  accountingPeriodValidation.validateFiscalYearOwnership(
    payload.accountingEntityId,
    payload.fiscalYear
  );
  const intervals = getCalendarPeriodIntervalsHelper({
    startDate: payload.fiscalYear.startDate,
    endDate: payload.fiscalYear.endDate,
    unit: payload.unit,
    count: payload.count,
  });
  accountingPeriodValidation.validatePartition(intervals, payload.fiscalYear);

  const timestamp = dateUtils.now();
  return intervals.map((interval, index) => {
    const period = deepFreeze<IAccountingPeriod>({
      id: stringUtils.generateUUID(),
      createdBy: payload.createdBy,
      name: `Accounting Period ${index + 1}`,
      accountingEntityId: payload.accountingEntityId,
      unit: payload.unit,
      count: payload.count,
      startDate: interval.startDate,
      endDate: interval.endDate,
      status: EPeriodStatus.Open,
      fiscalYearId: payload.fiscalYear.id,
      updatedAt: timestamp,
      closedAt: null,
    });
    const event = periodEvents.accountingPeriodCreated(period);
    const audit = accountingPeriodAudit.make({
      before: null,
      after: period,
      action: EPeriodActions.Created,
    });

    return [period, [event], audit];
  });
}

const accountingPeriodEntity = Object.freeze({
  make,
  ...accountingPeriodValidation,
});

export default accountingPeriodEntity;
