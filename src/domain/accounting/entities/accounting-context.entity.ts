import { TCreationOmits } from '@shared/types/creation-omits.types';
import stringUtils from '@shared/utils/string';
import generateUUID from '@shared/utils/uuid-generator';
import { TAuditedEntity } from '@shared/values/events/types/event.types';

import getAccountingContextDescription from '@domain/accounting/entities/helpers/get-description.helper';
import accountingContextValidation from '@domain/accounting/entities/validations/accounting-context.validation';
import accountingError from '@domain/accounting/errors/accounting.error';
import accountingContextEvents from '@domain/accounting/events/accounting-context.events';
import { EAccountingContextActions } from '@domain/accounting/types/accounting-context-audit.types';
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

const accountingContextEntity = Object.freeze({
  make,
  ...accountingContextValidation,
});

export default accountingContextEntity;
