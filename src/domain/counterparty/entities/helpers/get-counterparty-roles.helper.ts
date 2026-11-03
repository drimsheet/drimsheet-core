import {
  ECounterpartyRole,
  ICounterpartyRoleDetails,
  UCounterpartyRole,
} from '@domain/counterparty/types/counterparty.types';

/** Derives membership in a stable order from own keys in roleDetails. */
export default function getCounterpartyRolesHelper(
  roleDetails: ICounterpartyRoleDetails
): UCounterpartyRole[] {
  return Object.values(ECounterpartyRole).filter((role) =>
    Object.prototype.hasOwnProperty.call(roleDetails, role)
  );
}
