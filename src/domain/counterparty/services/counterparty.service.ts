import { IReadRepoOptions } from '@shared/types/repo.types';

import counterpartyEntity from '@domain/counterparty/entities/counterparty.entity';
import getUpdatedCounterpartyMetaHelper from '@domain/counterparty/services/helpers/get-updated-counterparty-meta.helper';
import counterpartyServiceValidation from '@domain/counterparty/services/validations/counterparty.validation';
import { ECounterpartyEntityActions } from '@domain/counterparty/types/counterparty-audit.types';
import ICounterpartyService from '@domain/counterparty/types/counterparty.service.types';
import { TCounterpartyRoleDetails } from '@domain/counterparty/types/counterparty.types';
import contractorMetaValue from '@domain/counterparty/values/contractor-meta.vo';
import counterpartyAuditValue from '@domain/counterparty/values/counterparty-audit.vo';
import employerMetaValue from '@domain/counterparty/values/employer-meta.vo';
import counterpartyMetaValidation from '@domain/counterparty/values/validations/counterparty-meta.validation';
import vendorMetaValue from '@domain/counterparty/values/vendor-meta.vo';
import IJournalLineRepo from '@domain/journal-entry/repos/journal-line.repo';

interface IDependencies {
  journalLineRepo: IJournalLineRepo;
}

/** Prepares all requested roles, immutable transition events, and one creation audit without persistence. */
function makeCreate(): ICounterpartyService['create'] {
  return (payload) => {
    const { meta } = payload;
    if (meta !== undefined) counterpartyMetaValidation.validateCreate(meta);

    const assignments: TCounterpartyRoleDetails[] = [];
    if (meta?.employer) {
      assignments.push({
        role: 'employer',
        meta: employerMetaValue.make(meta.employer),
      });
    }
    if (meta?.vendor) {
      assignments.push({
        role: 'vendor',
        meta: vendorMetaValue.make(meta.vendor),
      });
    }
    if (meta?.contractor) {
      assignments.push({
        role: 'contractor',
        meta: contractorMetaValue.make(meta.contractor),
      });
    }

    const creation = counterpartyEntity.make(payload);
    if (assignments.length === 0) return creation;

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
      meta: getUpdatedCounterpartyMetaHelper(payload.meta),
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
