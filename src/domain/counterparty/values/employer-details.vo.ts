import deepFreeze from '@shared/utils/deep-freeze';
import addressValue from '@shared/values/contact-details/address.vo';

import {
  ICounterpartyEmployerDetails,
  ICreateCounterpartyEmployerDetails,
} from '@domain/counterparty/types/counterparty.types';
import counterpartyRoleDetailsValidation from '@domain/counterparty/values/validations/counterparty-role-details.validation';
import counterpartyValidation from '@domain/counterparty/values/validations/counterparty.validation';

function make(
  payload: ICreateCounterpartyEmployerDetails
): Readonly<ICounterpartyEmployerDetails> {
  counterpartyRoleDetailsValidation.validateCreate({ employer: payload });
  const roleDetails = {
    displayName: counterpartyValidation.sanitizeDisplayName(
      payload.displayName
    ),
    address: addressValue.make(payload.address),
  };
  counterpartyRoleDetailsValidation.validate({ employer: roleDetails });
  return deepFreeze({
    displayName: roleDetails.displayName,
    address: roleDetails.address,
  });
}

const employerDetailsValue = Object.freeze({ make });
export default employerDetailsValue;
