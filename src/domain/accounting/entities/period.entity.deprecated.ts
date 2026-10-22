import dateUtils from '@shared/utils/date';
import numberUtils from '@shared/utils/number';
import stringUtils from '@shared/utils/string';
import generateUUID from '@shared/utils/uuid-generator';
import { TAuditedEntity } from '@shared/values/events/types/event.types';

import periodValidation from '@domain/accounting/entities/validations/period.validation';
import periodError from '@domain/accounting/errors/period.error';
import periodEvents from '@domain/accounting/events/period.events';
import { EPeriodActions } from '@domain/accounting/types/period-audit.types';
import { IReportingPeriod } from '@domain/accounting/types/period.types';
import reportingPeriodAudit from '@domain/accounting/values/reporting-period-audit.vo';

function makeReportingPeriod(
  payload: Pick<
    IReportingPeriod,
    | 'createdBy'
    | 'name'
    | 'accountingEntityId'
    | 'fiscalYearId'
    | 'unit'
    | 'count'
    | 'startDate'
    | 'endDate'
  >
): TAuditedEntity<IReportingPeriod, IReportingPeriod, IReportingPeriod> {
  const name = stringUtils.sanitizeAndValidate(
    payload.name,
    {
      min: 1,
      max: 100,
    },
    periodError.InvalidName
  );

  stringUtils.validateUUID(
    payload.accountingEntityId,
    periodError.InvalidAccountingEntityId
  );
  stringUtils.validateUUID(
    payload.fiscalYearId,
    periodError.InvalidFiscalYearId
  );

  periodValidation.validateUnit(payload.unit);

  numberUtils.validatePositiveNumber(payload.count, periodError.InvalidCount);

  dateUtils.validateGreaterThan(
    payload.endDate,
    payload.startDate,
    periodError.InvalidDateRange
  );

  stringUtils.validateUUID(payload.createdBy, periodError.InvalidCreatedBy);

  const timestamp = new Date();

  const entity = Object.freeze({
    id: generateUUID(),
    createdBy: payload.createdBy,
    name,
    accountingEntityId: payload.accountingEntityId,
    fiscalYearId: payload.fiscalYearId,
    unit: payload.unit,
    count: payload.count,
    startDate: payload.startDate,
    endDate: payload.endDate,
    updatedAt: timestamp,
  });

  const events = periodEvents.reportingPeriodCreated(entity);

  const audit = reportingPeriodAudit.make({
    before: null,
    after: entity,
    action: EPeriodActions.Created,
  });

  return [entity, [events], audit];
}

const periodEntity = Object.freeze({
  makeReportingPeriod,
  ...periodValidation,
});

export default periodEntity;
