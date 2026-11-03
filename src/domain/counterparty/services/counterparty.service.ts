import { IReadRepoOptions } from '@shared/types/repo.types';

import counterpartyEntity from '@domain/counterparty/entities/counterparty.entity';
import getUpdatedCounterpartyRoleDetailsHelper from '@domain/counterparty/services/helpers/get-updated-counterparty-role-details.helper';
import counterpartyServiceValidation from '@domain/counterparty/services/validations/counterparty.validation';
import { ECounterpartyEntityActions } from '@domain/counterparty/types/counterparty-audit.types';
import ICounterpartyService from '@domain/counterparty/types/counterparty.service.types';
import { TCounterpartyRoleDetails } from '@domain/counterparty/types/counterparty.types';
import contractorDetailsValue from '@domain/counterparty/values/contractor-details.vo';
import counterpartyAuditValue from '@domain/counterparty/values/counterparty-audit.vo';
import employerDetailsValue from '@domain/counterparty/values/employer-details.vo';
import counterpartyRoleDetailsValidation from '@domain/counterparty/values/validations/counterparty-role-details.validation';
import vendorDetailsValue from '@domain/counterparty/values/vendor-details.vo';
import IJournalLineRepo from '@domain/journal-entry/repos/journal-line.repo';

interface IDependencies {
  journalLineRepo: IJournalLineRepo;
}

/** Prepares all requested roles, immutable transition events, and one creation audit without persistence. */
function makeCreate(): ICounterpartyService['create'] {
  return (payload) => {
    const { roleDetails } = payload;
    if (roleDetails !== undefined) {
      counterpartyRoleDetailsValidation.validateCreate(roleDetails);
    }

    const assignments: TCounterpartyRoleDetails[] = [];
    if (roleDetails?.employer) {
      assignments.push({
        role: 'employer',
        roleDetails: employerDetailsValue.make(roleDetails.employer),
      });
    }
    if (roleDetails?.vendor) {
      assignments.push({
        role: 'vendor',
        roleDetails: vendorDetailsValue.make(roleDetails.vendor),
      });
    }
    if (roleDetails?.contractor) {
      assignments.push({
        role: 'contractor',
        roleDetails: contractorDetailsValue.make(roleDetails.contractor),
      });
    }

    const creation = counterpartyEntity.make(payload);
    if (assignments.length === 0) {
      return creation;
    }

    const [initialCounterparty, createdEvents] = creation;
    let counterparty = initialCounterparty;
    const events = [...createdEvents];
    for (const assignment of assignments) {
      const [assignedCounterparty, roleEvents] = counterpartyEntity.addRole(
        counterparty,
        assignment
      );
      counterparty = assignedCounterparty;
      events.push(...roleEvents);
    }

    const audit = counterpartyAuditValue.make({
      before: null,
      after: counterparty,
      action: ECounterpartyEntityActions.Created,
    });
    return [counterparty, events, audit];
  };
}

/** Normalizes complete replacement roles and prepares one audited update; rejects atomically. */
function makeUpdate(
  deps: Readonly<IDependencies>
): ICounterpartyService['update'] {
  return async (counterparty, payload, options: IReadRepoOptions) => {
    counterpartyEntity.validateCounterparty(counterparty);

    if (payload.type !== undefined) {
      counterpartyEntity.validateType(payload.type);
    }

    counterpartyEntity.validateUpdateStatus(
      counterparty.status,
      payload.status
    );

    const isTypeChange =
      payload.type !== undefined && payload.type !== counterparty.type;

    if (isTypeChange) {
      await counterpartyServiceValidation.validateTypeChangeAllowed(
        deps.journalLineRepo,
        counterparty.id,
        counterparty.accountingEntityId,
        options
      );
    }

    return counterpartyEntity.update(counterparty, {
      name: payload.name,
      type: payload.type,
      status: payload.status,
      roleDetails: getUpdatedCounterpartyRoleDetailsHelper(payload.roleDetails),
    });
  };
}

export default function makeCounterpartyService(
  deps: Readonly<IDependencies>
): ICounterpartyService {
  return Object.freeze({
    create: makeCreate(),
    update: makeUpdate(deps),
  });
}
