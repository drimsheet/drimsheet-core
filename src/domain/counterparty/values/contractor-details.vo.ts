import deepFreeze from '@shared/utils/deep-freeze';
import addressValue from '@shared/values/contact-details/address.vo';

import {
  ICounterpartyContractorDetails,
  ICreateCounterpartyContractorDetails,
} from '@domain/counterparty/types/counterparty.types';
import counterpartyRoleDetailsValidation from '@domain/counterparty/values/validations/counterparty-role-details.validation';

function make(
  payload: ICreateCounterpartyContractorDetails
): Readonly<ICounterpartyContractorDetails> {
  counterpartyRoleDetailsValidation.validateCreate({ contractor: payload });
  const roleDetails = {
    address: addressValue.make(payload.address),
  };
  counterpartyRoleDetailsValidation.validate({ contractor: roleDetails });
  return deepFreeze(roleDetails);
}

const contractorDetailsValue = Object.freeze({ make });
export default contractorDetailsValue;
