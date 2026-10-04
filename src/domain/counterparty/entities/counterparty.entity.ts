import deepFreeze from '@shared/utils/deep-freeze';
import generateDiff from '@shared/utils/diff-generator';
import stringUtils from '@shared/utils/string';
import generateUUID from '@shared/utils/uuid-generator';
import {
  IEvent,
  TAuditedEntity,
} from '@shared/values/events/types/event.types';

import getCounterpartyRolesHelper from '@domain/counterparty/entities/helpers/get-counterparty-roles.helper';
import counterpartyValidation from '@domain/counterparty/entities/validations/counterparty.validation';
import counterpartyError from '@domain/counterparty/errors/counterparty.error';
import counterpartyEvents from '@domain/counterparty/events/counterparty.events';
import {
  ECounterpartyEntityActions,
  ICounterpartyAudit,
} from '@domain/counterparty/types/counterparty-audit.types';
import {
  ECounterpartyStatus,
  ICounterparty,
  IMakeCounterpartyPayload,
  TAuditedCounterparty,
  TCounterpartyRoleDetails,
} from '@domain/counterparty/types/counterparty.types';
import counterpartyAuditValue from '@domain/counterparty/values/counterparty-audit.vo';
import counterpartyMetaValidation from '@domain/counterparty/values/validations/counterparty-meta.validation';

function make(payload: IMakeCounterpartyPayload): TAuditedCounterparty {
  counterpartyValidation.validateAccountingEntityId(payload.accountingEntityId);
  const name = counterpartyValidation.validateName(payload.name);
  const type = counterpartyValidation.validateType(payload.type);
  const status = payload.status
    ? counterpartyValidation.validateStatus(payload.status)
    : ECounterpartyStatus.Active;

  stringUtils.validateUUID(
    payload.createdBy,
    counterpartyError.InvalidCreatedBy
  );

  const timestamp = new Date();

  const counterparty: ICounterparty = deepFreeze({
    id: generateUUID(),
    createdBy: payload.createdBy,
    accountingEntityId: payload.accountingEntityId,
    name,
    status,
    type,
    roles: [],
    meta: {},
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const event = counterpartyEvents.created(counterparty);

  const audit = counterpartyAuditValue.make({
    before: null,
    after: counterparty,
    action: ECounterpartyEntityActions.Created,
  });

  return [counterparty, [event], audit] as const;
}

function addRole(
  counterparty: ICounterparty,
  details: TCounterpartyRoleDetails
): TAuditedEntity<ICounterparty, ICounterparty, ICounterparty> {
  counterpartyValidation.validateCounterparty(counterparty);
  const { role } = details;
  counterpartyValidation.validateRole(role);

  if (counterparty.roles.includes(role)) {
    throw new counterpartyError.RoleAlreadyAssigned({
      role,
      counterpartyId: counterparty.id,
    });
  }

  const meta = {
    ...counterparty.meta,
    [role]: details.meta,
  };
  counterpartyMetaValidation.validate(meta);
  const timestamp = new Date();

  const updatedCounterparty: ICounterparty = deepFreeze({
    id: counterparty.id,
    createdBy: counterparty.createdBy,
    accountingEntityId: counterparty.accountingEntityId,
    name: counterparty.name,
    status: counterparty.status,
    type: counterparty.type,
    roles: getCounterpartyRolesHelper(meta),
    meta,
    version: counterparty.version + 1,
    createdAt: counterparty.createdAt,
    updatedAt: timestamp,
  });

  const event = counterpartyEvents.roleAdded(updatedCounterparty);

  const audit = counterpartyAuditValue.make({
    before: counterparty,
    after: updatedCounterparty,
    action: ECounterpartyEntityActions.RoleAdded,
  });

  return [updatedCounterparty, [event], audit] as const;
}

/** Applies final validated details, retaining identity and auditing one transition. */
function update(
  counterparty: ICounterparty,
  details: Partial<Pick<ICounterparty, 'name' | 'type' | 'status' | 'meta'>>
): TAuditedCounterparty {
  counterpartyValidation.validateCounterparty(counterparty);
  counterpartyValidation.validateUpdateStatus(
    counterparty.status,
    details.status
  );

  const name = counterpartyValidation.validateName(
    details.name ?? counterparty.name
  );
  const type = counterpartyValidation.validateType(
    details.type ?? counterparty.type
  );
  const status = details.status ?? counterparty.status;
  const meta = details.meta ?? counterparty.meta;
  counterpartyMetaValidation.validate(meta);

  const hasMetaChanges = generateDiff(meta, counterparty.meta).hasChanges;
  const isUnchanged =
    name === counterparty.name &&
    type === counterparty.type &&
    status === counterparty.status &&
    !hasMetaChanges;

  if (isUnchanged) {
    throw new counterpartyError.InvalidUpdate();
  }

  const updatedCounterparty: ICounterparty = deepFreeze({
    id: counterparty.id,
    createdBy: counterparty.createdBy,
    accountingEntityId: counterparty.accountingEntityId,
    name,
    type,
    status,
    roles: getCounterpartyRolesHelper(meta),
    meta,
    version: counterparty.version + 1,
    createdAt: counterparty.createdAt,
    updatedAt: new Date(),
  });

  const isActivation = details.status === ECounterpartyStatus.Active;
  const event = isActivation
    ? counterpartyEvents.activated(updatedCounterparty)
    : counterpartyEvents.updated(updatedCounterparty);

  const audit = counterpartyAuditValue.make({
    before: counterparty,
    after: updatedCounterparty,
    action: isActivation
      ? ECounterpartyEntityActions.Activated
      : ECounterpartyEntityActions.Updated,
  });

  return [updatedCounterparty, [event], audit];
}

/** Archives once; an Archived source is returned unchanged without events or an audit. */
function archive(
  counterparty: ICounterparty
): [ICounterparty, IEvent<ICounterparty>[], ICounterpartyAudit | null] {
  counterpartyValidation.validateCounterparty(counterparty);
  if (counterparty.status === ECounterpartyStatus.Archived) {
    return [counterparty, [], null];
  }

  const archivedCounterparty: ICounterparty = deepFreeze({
    id: counterparty.id,
    createdBy: counterparty.createdBy,
    accountingEntityId: counterparty.accountingEntityId,
    name: counterparty.name,
    type: counterparty.type,
    status: ECounterpartyStatus.Archived,
    roles: counterparty.roles,
    meta: counterparty.meta,
    version: counterparty.version + 1,
    createdAt: counterparty.createdAt,
    updatedAt: new Date(),
  });

  const event = counterpartyEvents.archived(archivedCounterparty);
  const audit = counterpartyAuditValue.make({
    before: counterparty,
    after: archivedCounterparty,
    action: ECounterpartyEntityActions.Archived,
  });

  return [archivedCounterparty, [event], audit];
}

const counterpartyEntity = deepFreeze({
  make,
  addRole,
  update,
  archive,
  ...counterpartyValidation,
});

export default counterpartyEntity;
