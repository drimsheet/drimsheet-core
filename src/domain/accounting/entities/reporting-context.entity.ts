import { TCreationOmits } from '@shared/types/creation-omits.types';
import deepFreeze from '@shared/utils/deep-freeze';
import stringUtils from '@shared/utils/string';
import generateUUID from '@shared/utils/uuid-generator';
import {
  IEvent,
  TAuditedEntity,
} from '@shared/values/events/types/event.types';

import getAccountingContextDescription from '@domain/accounting/entities/helpers/get-description.helper';
import accountingContextValidation from '@domain/accounting/entities/validations/accounting-context.validation';
import reportingContextValidation from '@domain/accounting/entities/validations/reporting-context.validation';
import accountingError from '@domain/accounting/errors/accounting.error';
import reportingContextEvents from '@domain/accounting/events/reporting-context.events';
import { IReportingContext } from '@domain/accounting/types/context.types';
import {
  EReportingContextActions,
  IReportingContextAudit,
} from '@domain/accounting/types/reporting-context-audit.types';
import reportingContextAudit from '@domain/accounting/values/reporting-context-audit.vo';
import currencyEntity from '@domain/money/entities/currency.entity';

function make(
  payload: TCreationOmits<IReportingContext, 'closedAt'>
): TAuditedEntity<IReportingContext, IReportingContext, IReportingContext> {
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
    payload.currentReportingPeriodId,
    accountingError.InvalidCurrentReportingPeriodId
  );
  accountingContextValidation.validateAccountingStandardCode(
    payload.accountingStandardCode
  );

  const name = stringUtils.sanitizeAndValidate(
    payload.name,
    {
      min: 1,
      max: 150,
    },
    accountingError.InvalidName
  );
  const description = getAccountingContextDescription(payload.description);

  stringUtils.validateUUID(payload.createdBy, accountingError.InvalidCreatedBy);

  const timestamp = new Date();

  const entity: IReportingContext = deepFreeze({
    id: generateUUID(),
    createdBy: payload.createdBy,
    name,
    description,
    accountingEntityId: payload.accountingEntityId,
    reportingCurrencyCode: payload.reportingCurrencyCode,
    accountingContextId: payload.accountingContextId,
    currentReportingPeriodId: payload.currentReportingPeriodId,
    accountingStandardCode: payload.accountingStandardCode,
    createdAt: timestamp,
    updatedAt: timestamp,
    closedAt: null,
  });

  const events = reportingContextEvents.created(entity);

  const audit = reportingContextAudit.make({
    before: null,
    after: entity,
    action: EReportingContextActions.Created,
  });

  return [entity, [events], audit];
}

function update(
  context: IReportingContext,
  changes: Pick<IReportingContext, 'currentReportingPeriodId'>
): [
  IReportingContext,
  IEvent<IReportingContext>[],
  IReportingContextAudit | null,
] {
  stringUtils.validateUUID(
    changes.currentReportingPeriodId,
    accountingError.InvalidCurrentReportingPeriodId
  );

  if (context.currentReportingPeriodId === changes.currentReportingPeriodId) {
    return [context, [], null];
  }

  const entity: IReportingContext = deepFreeze({
    id: context.id,
    createdBy: context.createdBy,
    name: context.name,
    description: context.description,
    accountingEntityId: context.accountingEntityId,
    reportingCurrencyCode: context.reportingCurrencyCode,
    accountingContextId: context.accountingContextId,
    currentReportingPeriodId: changes.currentReportingPeriodId,
    accountingStandardCode: context.accountingStandardCode,
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
