import deepFreeze from '@shared/utils/deep-freeze';
import stringUtils from '@shared/utils/string';
import { TAuditedEntity } from '@shared/values/events/types/event.types';

import getCalendarPeriodIntervalsHelper from '@domain/accounting/entities/helpers/get-calendar-period-intervals.helper';
import reportingPeriodValidation from '@domain/accounting/entities/validations/reporting-period.validation';
import periodError from '@domain/accounting/errors/period.error';
import periodEvents from '@domain/accounting/events/period.events';
import { IFiscalYear } from '@domain/accounting/types/fiscal-year.types';
import { EPeriodActions } from '@domain/accounting/types/period-audit.types';
import { IReportingPeriod } from '@domain/accounting/types/period.types';
import reportingPeriodAudit from '@domain/accounting/values/reporting-period-audit.vo';

interface IMakePayload extends Pick<
  IReportingPeriod,
  'createdBy' | 'accountingEntityId' | 'unit' | 'count'
> {
  fiscalYear: IFiscalYear;
}

function make(
  payload: IMakePayload
): TAuditedEntity<IReportingPeriod, IReportingPeriod, IReportingPeriod>[] {
  stringUtils.validateUUID(
    payload.accountingEntityId,
    periodError.InvalidAccountingEntityId
  );
  stringUtils.validateUUID(
    payload.fiscalYear.id,
    periodError.InvalidFiscalYearId
  );
  reportingPeriodValidation.validateFiscalYearOwnership(
    payload.accountingEntityId,
    payload.fiscalYear
  );

  const intervals = getCalendarPeriodIntervalsHelper({
    startDate: payload.fiscalYear.startDate,
    endDate: payload.fiscalYear.endDate,
    unit: payload.unit,
    count: payload.count,
  });
  reportingPeriodValidation.validateFiscalYearBounds(
    intervals,
    payload.fiscalYear
  );

  stringUtils.validateUUID(payload.createdBy, periodError.InvalidCreatedBy);

  const timestamp = new Date();

  const reportingPeriods: IReportingPeriod[] = intervals.map(
    (interval, index) =>
      deepFreeze({
        id: stringUtils.generateUUID(),
        createdBy: payload.createdBy,
        name: `Reporting Period ${index + 1}`,
        accountingEntityId: payload.accountingEntityId,
        unit: payload.unit,
        count: payload.count,
        startDate: interval.startDate,
        endDate: interval.endDate,
        fiscalYearId: payload.fiscalYear.id,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
  );

  return reportingPeriods.map((period) => {
    const event = periodEvents.reportingPeriodCreated(period);
    const audit = reportingPeriodAudit.make({
      before: null,
      after: period,
      action: EPeriodActions.Created,
    });

    return [period, [event], audit];
  });
}

const reportingPeriodEntity = Object.freeze({
  make,
  ...reportingPeriodValidation,
});

export default reportingPeriodEntity;
