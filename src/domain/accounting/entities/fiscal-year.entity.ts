import stringUtils from '@shared/utils/string';
import generateUUID from '@shared/utils/uuid-generator';
import { TAuditedEntity } from '@shared/values/events/types/event.types';

import deriveFiscalYearName from '@domain/accounting/entities/helpers/derive-name.helper';
import fiscalYearValidation from '@domain/accounting/entities/validations/fiscal-year.validation';
import periodError from '@domain/accounting/errors/period.error';
import periodEvents from '@domain/accounting/events/period.events';
import { EFiscalYearActions } from '@domain/accounting/types/fiscal-year-audit.types';
import { IFiscalYear } from '@domain/accounting/types/fiscal-year.types';
import fiscalYearAudit from '@domain/accounting/values/fiscal-year-audit.vo';

interface IMakePayload extends Pick<
  IFiscalYear,
  'createdBy' | 'accountingEntityId' | 'startDate' | 'endDate' | 'status'
> {
  name?: string;
}

function make(
  payload: IMakePayload
): TAuditedEntity<IFiscalYear, IFiscalYear, IFiscalYear> {
  fiscalYearValidation.validateStatus(payload.status);
  fiscalYearValidation.validateStartAndEndDate(payload);
  stringUtils.validateUUID(
    payload.accountingEntityId,
    periodError.InvalidAccountingEntityId
  );

  const name = deriveFiscalYearName(
    payload.startDate,
    payload.endDate,
    payload.name ?? null,
    false
  );
  stringUtils.validateUUID(payload.createdBy, periodError.InvalidCreatedBy);

  const timestamp = new Date();

  const entity = Object.freeze<IFiscalYear>({
    id: generateUUID(),
    createdBy: payload.createdBy,
    name,
    accountingEntityId: payload.accountingEntityId,
    startDate: payload.startDate,
    endDate: payload.endDate,
    status: payload.status,
    closedAt: null,
    updatedAt: timestamp,
  });

  const events = periodEvents.fiscalYearCreated(entity);

  const audit = fiscalYearAudit.make({
    before: null,
    after: entity,
    action: EFiscalYearActions.Created,
  });

  return [entity, [events], audit];
}

const fiscalYearEntity = Object.freeze({
  make,
  ...fiscalYearValidation,
});

export default fiscalYearEntity;
