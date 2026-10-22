import deepFreeze from '@shared/utils/deep-freeze';
import hasChanges from '@shared/utils/has-changes';
import stringUtils from '@shared/utils/string';
import generateUUID from '@shared/utils/uuid-generator';

import getAccountingContextDescription from '@domain/accounting/entities/helpers/get-description.helper';
import accountingContextValidation from '@domain/accounting/entities/validations/accounting-context.validation';
import accountingError from '@domain/accounting/errors/accounting.error';
import accountingContextEvents from '@domain/accounting/events/accounting-context.events';
import {
  EAccountingContextActions,
  TAuditedAccountingContext,
  TAuditedAccountingContextUpdate,
} from '@domain/accounting/types/accounting-context-audit.types';
import {
  IAccountingContext,
  IAccountingContextMakePayload,
  IAccountingContextUpdatePayload,
} from '@domain/accounting/types/context.types';
import accountingContextAudit from '@domain/accounting/values/accounting-context-audit.vo';

function make(
  payload: IAccountingContextMakePayload
): TAuditedAccountingContext {
  stringUtils.validateUUID(
    payload.accountingEntityId,
    accountingError.InvalidAccountingEntityId
  );
  accountingContextValidation.validateAccountingStandardCode(
    payload.accountingStandardCode
  );
  stringUtils.validateUUID(
    payload.fiscalYearId,
    accountingError.InvalidFiscalYearId
  );
  stringUtils.validateUUID(
    payload.accountingIntervalId,
    accountingError.InvalidAccountingIntervalId
  );

  const name = stringUtils.sanitizeAndValidate(
    payload.name,
    { min: 1, max: 150 },
    accountingError.InvalidName
  );
  const description = getAccountingContextDescription(payload.description);
  stringUtils.validateUUID(payload.createdBy, accountingError.InvalidCreatedBy);

  const timestamp = new Date();
  const entity = deepFreeze<IAccountingContext>({
    id: generateUUID(),
    createdBy: payload.createdBy,
    name,
    description,
    accountingEntityId: payload.accountingEntityId,
    accountingStandardCode: payload.accountingStandardCode,
    fiscalYearId: payload.fiscalYearId,
    accountingIntervalId: payload.accountingIntervalId,
    createdAt: timestamp,
    updatedAt: timestamp,
    closedAt: null,
  });
  const event = accountingContextEvents.created(entity);
  const audit = accountingContextAudit.make({
    before: null,
    after: entity,
    action: EAccountingContextActions.Created,
  });

  return [entity, [event], audit];
}

function update(
  context: IAccountingContext,
  changes: IAccountingContextUpdatePayload
): TAuditedAccountingContextUpdate {
  const {
    name: nameInput = context.name,
    description: descriptionInput = context.description,
    accountingIntervalId = context.accountingIntervalId,
  } = changes;

  const name = stringUtils.sanitizeAndValidate(
    nameInput,
    { min: 1, max: 150 },
    accountingError.InvalidName
  );
  const description = getAccountingContextDescription(descriptionInput);
  stringUtils.validateUUID(
    accountingIntervalId,
    accountingError.InvalidAccountingIntervalId
  );

  const isUnchanged = !hasChanges(context, {
    name,
    description,
    accountingIntervalId,
  });
  if (isUnchanged) {
    return [context, [], null];
  }

  const entity = deepFreeze<IAccountingContext>({
    id: context.id,
    createdBy: context.createdBy,
    name,
    description,
    accountingEntityId: context.accountingEntityId,
    accountingStandardCode: context.accountingStandardCode,
    fiscalYearId: context.fiscalYearId,
    accountingIntervalId,
    createdAt: context.createdAt,
    updatedAt: new Date(),
    closedAt: context.closedAt,
  });
  const audit = accountingContextAudit.make({
    before: context,
    after: entity,
    action: EAccountingContextActions.Updated,
  });

  return [entity, [accountingContextEvents.updated(entity)], audit];
}

const accountingContextEntity = Object.freeze({
  make,
  update,
  ...accountingContextValidation,
});

export default accountingContextEntity;
