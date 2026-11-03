import addressError from '@shared/values/contact-details/address.error';

import counterpartyError from '@domain/counterparty/errors/counterparty.error';
import {
  ICounterpartyRoleDetails,
  ICreateCounterpartyRoleDetails,
} from '@domain/counterparty/types/counterparty.types';
import contractorDetailsValue from '@domain/counterparty/values/contractor-details.vo';
import employerDetailsValue from '@domain/counterparty/values/employer-details.vo';
import counterpartyRoleDetailsValidation from '@domain/counterparty/values/validations/counterparty-role-details.validation';
import vendorDetailsValue from '@domain/counterparty/values/vendor-details.vo';

/**
 * Derives complete replacement roles, preserving omission and reporting
 * address errors by role.
 */
export default function getUpdatedCounterpartyRoleDetailsHelper(
  requestedRoleDetails: ICreateCounterpartyRoleDetails | undefined
): ICounterpartyRoleDetails | undefined {
  if (requestedRoleDetails === undefined) {
    return undefined;
  }

  counterpartyRoleDetailsValidation.validateCreate(requestedRoleDetails);
  const roleDetails: ICounterpartyRoleDetails = {};

  for (const role of ['employer', 'vendor', 'contractor'] as const) {
    const isOmittedRole = requestedRoleDetails[role] === undefined;
    if (isOmittedRole) {
      continue;
    }

    try {
      switch (role) {
        case 'employer':
          roleDetails.employer = employerDetailsValue.make(
            requestedRoleDetails.employer!
          );
          break;
        case 'vendor':
          roleDetails.vendor = vendorDetailsValue.make(
            requestedRoleDetails.vendor!
          );
          break;
        case 'contractor':
          roleDetails.contractor = contractorDetailsValue.make(
            requestedRoleDetails.contractor!
          );
          break;
      }
    } catch (error) {
      const isAddressError = error instanceof addressError.Base;
      if (!isAddressError) {
        throw error;
      }
      throw new counterpartyError.InvalidAddress({
        field: `roleDetails.${role}.address`,
      });
    }
  }

  return roleDetails;
}
