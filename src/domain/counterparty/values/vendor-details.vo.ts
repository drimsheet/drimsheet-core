import deepFreeze from '@shared/utils/deep-freeze';
import addressValue from '@shared/values/contact-details/address.vo';

import {
  ICounterpartyVendorDetails,
  ICreateCounterpartyVendorDetails,
} from '@domain/counterparty/types/counterparty.types';
import counterpartyRoleDetailsValidation from '@domain/counterparty/values/validations/counterparty-role-details.validation';

function make(
  payload: ICreateCounterpartyVendorDetails
): Readonly<ICounterpartyVendorDetails> {
  counterpartyRoleDetailsValidation.validateCreate({ vendor: payload });
  const roleDetails = {
    address:
      payload.address == null ? null : addressValue.make(payload.address),
  };
  counterpartyRoleDetailsValidation.validate({ vendor: roleDetails });
  return deepFreeze(roleDetails);
}

const vendorDetailsValue = Object.freeze({ make });
export default vendorDetailsValue;
