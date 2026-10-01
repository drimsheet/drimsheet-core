import addressError from '@shared/values/contact-details/address.error';

import counterpartyError from '@domain/counterparty/errors/counterparty.error';
import {
  ICounterpartyMeta,
  ICreateCounterpartyMeta,
} from '@domain/counterparty/types/counterparty.types';
import contractorMetaValue from '@domain/counterparty/values/contractor-meta.vo';
import employerMetaValue from '@domain/counterparty/values/employer-meta.vo';
import counterpartyMetaValidation from '@domain/counterparty/values/validations/counterparty-meta.validation';
import vendorMetaValue from '@domain/counterparty/values/vendor-meta.vo';

/** Derives complete replacement roles, preserving omission and reporting address errors by role. */
export default function getUpdatedCounterpartyMetaHelper(
  requestedMeta: ICreateCounterpartyMeta | undefined
): ICounterpartyMeta | undefined {
  if (requestedMeta === undefined) return undefined;

  counterpartyMetaValidation.validateCreate(requestedMeta);
  const meta: ICounterpartyMeta = {};

  for (const role of ['employer', 'vendor', 'contractor'] as const) {
    const isOmittedRole = requestedMeta[role] === undefined;
    if (isOmittedRole) continue;

    try {
      switch (role) {
        case 'employer':
          meta.employer = employerMetaValue.make(requestedMeta.employer!);
          break;
        case 'vendor':
          meta.vendor = vendorMetaValue.make(requestedMeta.vendor!);
          break;
        case 'contractor':
          meta.contractor = contractorMetaValue.make(requestedMeta.contractor!);
          break;
      }
    } catch (error) {
      const isAddressError = error instanceof addressError.Base;
      if (!isAddressError) throw error;
      throw new counterpartyError.InvalidAddress({
        field: `meta.${role}.address`,
      });
    }
  }

  return meta;
}
