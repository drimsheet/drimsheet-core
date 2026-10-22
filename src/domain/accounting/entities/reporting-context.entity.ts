import deepFreeze from '@shared/utils/deep-freeze';
import stringUtils from '@shared/utils/string';
import generateUUID from '@shared/utils/uuid-generator';

import getAccountingContextDescription from '@domain/accounting/entities/helpers/get-description.helper';
import reportingContextValidation from '@domain/accounting/entities/validations/reporting-context.validation';
import accountingError from '@domain/accounting/errors/accounting.error';
import reportingContextEvents from '@domain/accounting/events/reporting-context.events';
import {
  IReportingContext,
  IReportingContextMakePayload,
  IReportingContextUpdatePayload,
} from '@domain/accounting/types/context.types';
import {
  EReportingContextActions,
  TAuditedReportingContext,
  TAuditedReportingContextUpdate,
} from '@domain/accounting/types/reporting-context-audit.types';
import reportingContextAudit from '@domain/accounting/values/reporting-context-audit.vo';
import currencyEntity from '@domain/money/entities/currency.entity';

function make(payload: IReportingContextMakePayload): TAuditedReportingContext {
  stringUtils.validateUUID(
    payload.accountingEntityId,
    accountingError.InvalidAccountingEntityId
  );
  currencyEntity.validateCode(payload.reportingCurrencyCode);
  stringUtils.validateUUID(
    payload.accountingContextId,
    accountingError.InvalidAccountingContextId
  );
  stringUtils.validateUUID(
    payload.reportingIntervalId,
    accountingError.InvalidReportingIntervalId
  );

  const name = stringUtils.sanitizeAndValidate(
    payload.name,
    { min: 1, max: 150 },
    accountingError.InvalidName
  );
  const description = getAccountingContextDescription(payload.description);
  stringUtils.validateUUID(payload.createdBy, accountingError.InvalidCreatedBy);

  const timestamp = new Date();
  const entity = deepFreeze<IReportingContext>({
    id: generateUUID(),
    createdBy: payload.createdBy,
    name,
    description,
    accountingEntityId: payload.accountingEntityId,
    reportingCurrencyCode: payload.reportingCurrencyCode,
    accountingContextId: payload.accountingContextId,
    reportingIntervalId: payload.reportingIntervalId,
    createdAt: timestamp,
    updatedAt: timestamp,
    closedAt: null,
  });
  const event = reportingContextEvents.created(entity);
  const audit = reportingContextAudit.make({
    before: null,
    after: entity,
    action: EReportingContextActions.Created,
  });

  return [entity, [event], audit];
}

function update(
  context: IReportingContext,
  changes: IReportingContextUpdatePayload
): TAuditedReportingContextUpdate {
  const { reportingIntervalId = context.reportingIntervalId } = changes;
  stringUtils.validateUUID(
    reportingIntervalId,
    accountingError.InvalidReportingIntervalId
  );

  const isUnchanged = context.reportingIntervalId === reportingIntervalId;
  if (isUnchanged) {
    return [context, [], null];
  }

  const entity = deepFreeze<IReportingContext>({
    id: context.id,
    createdBy: context.createdBy,
    name: context.name,
    description: context.description,
    accountingEntityId: context.accountingEntityId,
    reportingCurrencyCode: context.reportingCurrencyCode,
    accountingContextId: context.accountingContextId,
    reportingIntervalId,
    createdAt: context.createdAt,
    updatedAt: new Date(),
    closedAt: context.closedAt,
  });
  const audit = reportingContextAudit.make({
    before: context,
    after: entity,
    action: EReportingContextActions.Updated,
  });

  return [entity, [reportingContextEvents.updated(entity)], audit];
}

const reportingContextEntity = Object.freeze({
  make,
  update,
  ...reportingContextValidation,
});

export default reportingContextEntity;
