import { TEntityId } from '@shared/types/uuid';
import dateUtils from '@shared/utils/date';
import stringUtils from '@shared/utils/string';

import getCounterpartyRolesHelper from '@domain/counterparty/entities/helpers/get-counterparty-roles.helper';
import counterpartyError from '@domain/counterparty/errors/counterparty.error';
import {
  ECounterpartyRole,
  ECounterpartyStatus,
  ECounterpartyType,
  ICounterparty,
  UCounterpartyRole,
  UCounterpartyStatus,
  UCounterpartyType,
} from '@domain/counterparty/types/counterparty.types';
import counterpartyMetaValidation from '@domain/counterparty/values/validations/counterparty-meta.validation';

function validateVersion(version: number): void {
  const isInvalidVersion = !Number.isInteger(version) || version < 1;
  if (isInvalidVersion) throw new counterpartyError.InvalidVersion({ version });
}

function validateAccountingEntityId(accountingEntityId: TEntityId): void {
  stringUtils.validateUUID(
    accountingEntityId,
    counterpartyError.InvalidAccountingEntityId
  );
}

function validateName(name: string): string {
  return stringUtils.sanitizeAndValidate(
    name,
    { min: 1, max: 255 },
    counterpartyError.InvalidName
  );
}

function validateType(type: UCounterpartyType): UCounterpartyType {
  stringUtils.validateIsInEnum(
    type,
    ECounterpartyType,
    counterpartyError.InvalidType
  );
  return type;
}

/** Rejects draft creation when the caller has not supplied a type. */
function validateDraftCreationType(
  status: UCounterpartyStatus,
  type: UCounterpartyType | undefined
): void {
  const isMissingDraftType =
    status === ECounterpartyStatus.Draft && type === undefined;
  if (isMissingDraftType) throw new counterpartyError.InvalidType();
}

function validateStatus(status: UCounterpartyStatus): UCounterpartyStatus {
  stringUtils.validateIsInEnum(
    status,
    ECounterpartyStatus,
    counterpartyError.InvalidStatus
  );
  return status;
}

function validateRole(role: UCounterpartyRole): UCounterpartyRole {
  stringUtils.validateIsInEnum(
    role,
    ECounterpartyRole,
    counterpartyError.InvalidRole
  );
  return role;
}

function validateCounterparty(counterparty: ICounterparty): void {
  const isInvalidEntity = !counterparty || typeof counterparty !== 'object';
  if (isInvalidEntity) {
    throw new counterpartyError.InvalidCounterpartyEntity({ counterparty });
  }

  stringUtils.validateUUID(
    counterparty.id,
    counterpartyError.InvalidCounterpartyId
  );
  stringUtils.validateUUID(
    counterparty.createdBy,
    counterpartyError.InvalidCreatedBy
  );
  validateVersion(counterparty.version);
  validateAccountingEntityId(counterparty.accountingEntityId);
  validateName(counterparty.name);
  validateType(counterparty.type);
  validateStatus(counterparty.status);

  if (!Array.isArray(counterparty.roles)) {
    throw new counterpartyError.InvalidRole({ roles: counterparty.roles });
  }
  for (const role of counterparty.roles) {
    validateRole(role);
  }

  counterpartyMetaValidation.validate(counterparty.meta);
  const expectedRoles = getCounterpartyRolesHelper(counterparty.meta);
  const hasInconsistentRoles =
    counterparty.roles.length !== expectedRoles.length ||
    expectedRoles.some((role) => !counterparty.roles.includes(role));
  if (hasInconsistentRoles)
    throw new counterpartyError.InvalidRole({ roles: counterparty.roles });

  dateUtils.validateDate(counterparty.createdAt, counterpartyError.InvalidDate);
  dateUtils.validateDate(counterparty.updatedAt, counterpartyError.InvalidDate);
}

/** Checks update eligibility and treats an explicit Active status as activation. */
function validateUpdateStatus(
  currentStatus: UCounterpartyStatus,
  status: UCounterpartyStatus | undefined
): void {
  if (currentStatus === ECounterpartyStatus.Archived)
    throw new counterpartyError.Archived();
  const invalidTarget =
    status !== undefined && status !== ECounterpartyStatus.Active;
  if (invalidTarget)
    throw new counterpartyError.InvalidStatus({ field: 'status' });
  const alreadyActive =
    status === ECounterpartyStatus.Active &&
    currentStatus === ECounterpartyStatus.Active;
  if (alreadyActive) throw new counterpartyError.AlreadyActive();
}

const counterpartyValidation = Object.freeze({
  validateUpdateStatus,
  validateVersion,
  validateAccountingEntityId,
  validateName,
  validateType,
  validateDraftCreationType,
  validateStatus,
  validateRole,
  validateCounterparty,
});

export default counterpartyValidation;
