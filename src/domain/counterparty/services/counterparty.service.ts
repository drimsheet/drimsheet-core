import addressError from '@shared/values/contact-details/address.error';

import counterpartyEntity from '@domain/counterparty/entities/counterparty.entity';
import counterpartyError from '@domain/counterparty/errors/counterparty.error';
import { ECounterpartyEntityActions } from '@domain/counterparty/types/counterparty-audit.types';
import ICounterpartyService from '@domain/counterparty/types/counterparty.service.types';
import {
  ICounterpartyMeta,
  TCounterpartyRoleDetails,
} from '@domain/counterparty/types/counterparty.types';
import contractorMetaValue from '@domain/counterparty/values/contractor-meta.vo';
import counterpartyAuditValue from '@domain/counterparty/values/counterparty-audit.vo';
import employerMetaValue from '@domain/counterparty/values/employer-meta.vo';
import counterpartyMetaValidation from '@domain/counterparty/values/validations/counterparty-meta.validation';
import vendorMetaValue from '@domain/counterparty/values/vendor-meta.vo';

/** Prepares all requested roles, immutable transition events, and one creation audit without persistence. */
function makeCreate(): ICounterpartyService['create'] {
  return (payload) => {
    const meta = payload.meta === undefined ? {} : payload.meta;
    counterpartyMetaValidation.validateCreate(meta);

    const assignments: TCounterpartyRoleDetails[] = [];
    if (meta.employer) {
      assignments.push({
        role: 'employer',
        meta: employerMetaValue.make(meta.employer),
      });
    }
    if (meta.vendor) {
      assignments.push({
        role: 'vendor',
        meta: vendorMetaValue.make(meta.vendor),
      });
    }
    if (meta.contractor) {
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
function makeUpdate(): ICounterpartyService['update'] {
  return (counterparty, payload) => {
    counterpartyEntity.validateUpdateStatus(
      counterparty.status,
      payload.status
    );
    let meta: ICounterpartyMeta | undefined;
    if (payload.meta !== undefined) {
      counterpartyMetaValidation.validateCreate(payload.meta);
      meta = {};
      for (const role of ['employer', 'vendor', 'contractor'] as const) {
        try {
          const hasEmployer =
            role === 'employer' && payload.meta.employer !== undefined;
          const hasVendor =
            role === 'vendor' && payload.meta.vendor !== undefined;
          const hasContractor =
            role === 'contractor' && payload.meta.contractor !== undefined;
          if (hasEmployer)
            meta.employer = employerMetaValue.make(payload.meta.employer!);
          if (hasVendor)
            meta.vendor = vendorMetaValue.make(payload.meta.vendor!);
          if (hasContractor)
            meta.contractor = contractorMetaValue.make(
              payload.meta.contractor!
            );
        } catch (error) {
          const isAddressError = error instanceof addressError.Base;
          if (!isAddressError) throw error;
          throw new counterpartyError.InvalidAddress({
            field: `meta.${role}.address`,
          });
        }
      }
    }
    return counterpartyEntity.update(counterparty, {
      name: payload.name,
      type: payload.type,
      status: payload.status,
      meta,
    });
  };
}

export default function makeCounterpartyService(): ICounterpartyService {
  return Object.freeze({ create: makeCreate(), update: makeUpdate() });
}
