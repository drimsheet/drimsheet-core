import { TCreationOmits } from '@shared/types/creation-omits.types';
import hasChanges from '@shared/utils/has-changes';
import stringUtils from '@shared/utils/string';
import generateUUID from '@shared/utils/uuid-generator';
import {
  IEvent,
  TAuditedEntity,
} from '@shared/values/events/types/event.types';

import getAccountingContextDescription from '@domain/accounting/entities/helpers/get-description.helper';
import accountingContextValidation from '@domain/accounting/entities/validations/accounting-context.validation';
import accountingError from '@domain/accounting/errors/accounting.error';
import accountingContextEvents from '@domain/accounting/events/accounting-context.events';
import {
  EAccountingContextActions,
  IAccountingContextAudit,
} from '@domain/accounting/types/accounting-context-audit.types';
import { IAccountingContext } from '@domain/accounting/types/context.types';
import accountingContextAudit from '@domain/accounting/values/accounting-context-audit.vo';

function make(
  payload: TCreationOmits<IAccountingContext, 'closedAt'>
): TAuditedEntity<IAccountingContext, IAccountingContext, IAccountingContext> {
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
    payload.currentAccountingPeriodId,
    accountingError.InvalidCurrentAccountingPeriodId
  );
  if (payload.previousAccountingPeriodId !== null) {
    stringUtils.validateUUID(
      payload.previousAccountingPeriodId,
      accountingError.InvalidPreviousAccountingPeriodId
    );
  }
  if (payload.nextAccountingPeriodId !== null) {
    stringUtils.validateUUID(
      payload.nextAccountingPeriodId,
      accountingError.InvalidNextAccountingPeriodId
    );
  }

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

  const entity: IAccountingContext = Object.freeze({
    id: generateUUID(),
    createdBy: payload.createdBy,
    name,
    description,
    accountingEntityId: payload.accountingEntityId,
    accountingStandardCode: payload.accountingStandardCode,
    fiscalYearId: payload.fiscalYearId,
    currentAccountingPeriodId: payload.currentAccountingPeriodId,
    previousAccountingPeriodId: payload.previousAccountingPeriodId,
    nextAccountingPeriodId: payload.nextAccountingPeriodId,
    createdAt: timestamp,
    updatedAt: timestamp,
    closedAt: null,
  });

  const events = accountingContextEvents.created(entity);

  const audit = accountingContextAudit.make({
    before: null,
    after: entity,
    action: EAccountingContextActions.Created,
  });

  return [entity, [events], audit];
}

function update(
  context: IAccountingContext,
  changes: Partial<
    Pick<
      IAccountingContext,
      | 'name'
      | 'description'
      | 'previousAccountingPeriodId'
      | 'currentAccountingPeriodId'
      | 'nextAccountingPeriodId'
    >
  >
): [
  IAccountingContext,
  IEvent<IAccountingContext>[],
  IAccountingContextAudit | null,
] {
  const name = stringUtils.sanitizeAndValidate(
    changes.name ?? context.name,
    { min: 1, max: 150 },
    accountingError.InvalidName
  );
  const {
    description: descriptionInput = context.description,
    previousAccountingPeriodId = context.previousAccountingPeriodId,
    nextAccountingPeriodId = context.nextAccountingPeriodId,
  } = changes;
  const description = getAccountingContextDescription(descriptionInput);

  const currentAccountingPeriodId =
    changes.currentAccountingPeriodId ?? context.currentAccountingPeriodId;

  const isUnchanged = !hasChanges(context, {
    name,
    description,
    previousAccountingPeriodId,
    currentAccountingPeriodId,
    nextAccountingPeriodId,
  });

  if (isUnchanged) {
    return [context, [], null];
  }

  stringUtils.validateUUID(
    currentAccountingPeriodId,
    accountingError.InvalidCurrentAccountingPeriodId
  );
  if (previousAccountingPeriodId !== null) {
    stringUtils.validateUUID(
      previousAccountingPeriodId,
      accountingError.InvalidPreviousAccountingPeriodId
    );
  }
  if (nextAccountingPeriodId !== null) {
    stringUtils.validateUUID(
      nextAccountingPeriodId,
      accountingError.InvalidNextAccountingPeriodId
    );
  }

  const entity: IAccountingContext = Object.freeze({
    id: context.id,
    createdBy: context.createdBy,
    name,
    description,
    accountingEntityId: context.accountingEntityId,
    accountingStandardCode: context.accountingStandardCode,
    fiscalYearId: context.fiscalYearId,
    previousAccountingPeriodId,
    currentAccountingPeriodId,
    nextAccountingPeriodId,
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
