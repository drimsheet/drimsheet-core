import isPlainObject from '@shared/utils/is-plain-object';
import addressValue from '@shared/values/contact-details/address.vo';
import { IAddress } from '@shared/values/contact-details/types/address.types';

import counterpartyError from '@domain/counterparty/errors/counterparty.error';
import {
  ECounterpartyRole,
  ICounterpartyMeta,
  ICreateCounterpartyMeta,
  UCounterpartyRole,
} from '@domain/counterparty/types/counterparty.types';

// TODO: Rename this value-returning validation to a check; reserve validate
// for checks that only throw on failure and return no value.
function validateObject(value: unknown): Record<string, unknown> {
  const isInvalidObject = !isPlainObject(value);
  if (isInvalidObject) throw new counterpartyError.InvalidMeta({ value });
  return value as Record<string, unknown>;
}

/** Checks raw role details before value construction normalizes optional fields. */
function validateCreate(meta: ICreateCounterpartyMeta): void {
  validateObject(meta);
  for (const role of Object.keys(meta)) {
    const isUnknownRole =
      !Object.values<string>(ECounterpartyRole).includes(role);
    if (isUnknownRole) throw new counterpartyError.InvalidMeta({ role });

    const details = validateObject(meta[role as UCounterpartyRole]);
    const allowedKeys =
      role === ECounterpartyRole.Employer
        ? ['address', 'displayName']
        : ['address'];
    const hasUnknownFields = Object.keys(details).some(
      (key) => !allowedKeys.includes(key)
    );
    if (hasUnknownFields) throw new counterpartyError.InvalidMeta({ role });

    if (role === ECounterpartyRole.Employer) {
      const displayName = details.displayName;
      const isInvalidName =
        displayName !== undefined &&
        displayName !== null &&
        typeof displayName !== 'string';
      if (isInvalidName)
        throw new counterpartyError.InvalidName({ displayName });
    }

    const address = details.address;
    const isAbsentAddress = address === undefined || address === null;
    if (isAbsentAddress) {
      if (role !== ECounterpartyRole.Vendor)
        throw new counterpartyError.InvalidAddress({ address });
      continue;
    }

    const addressFields = validateObject(address);
    const addressKeys = [
      'line1',
      'line2',
      'city',
      'region',
      'postalCode',
      'countryCode',
    ];
    const hasUnknownAddressFields = Object.keys(addressFields).some(
      (key) => !addressKeys.includes(key)
    );
    if (hasUnknownAddressFields)
      throw new counterpartyError.InvalidAddress({ address });

    for (const key of ['line2', 'region', 'postalCode']) {
      const value = addressFields[key];
      const isInvalidOptionalField =
        value !== undefined && value !== null && typeof value !== 'string';
      if (isInvalidOptionalField)
        throw new counterpartyError.InvalidAddress({ address });
    }
  }
}

function validateAddress(address: IAddress | null, required: boolean): void {
  if (address === null) {
    if (required) throw new counterpartyError.InvalidAddress({ address });
    return;
  }
  const isInvalidAddress =
    !address || typeof address !== 'object' || Array.isArray(address);
  if (isInvalidAddress) throw new counterpartyError.InvalidAddress({ address });
  addressValue.validate(address);
  const optionalFields = [
    { value: address.line2, max: 255 },
    { value: address.region, max: 100 },
    { value: address.postalCode, max: 20 },
  ];
  for (const field of optionalFields) {
    const isInvalidField =
      field.value !== null &&
      (typeof field.value !== 'string' || field.value.length > field.max);
    if (isInvalidField) throw new counterpartyError.InvalidAddress({ address });
  }
}

function validate(meta: ICounterpartyMeta): void {
  validateObject(meta);
  for (const role of Object.keys(meta)) {
    const isUnknownRole =
      !Object.values<string>(ECounterpartyRole).includes(role);
    if (isUnknownRole) throw new counterpartyError.InvalidMeta({ role });
    validateObject(meta[role as UCounterpartyRole]);
  }
  if (meta.employer) {
    const displayName = meta.employer.displayName;
    const isInvalidDisplayName =
      displayName !== null &&
      (typeof displayName !== 'string' || displayName.length > 255);
    if (isInvalidDisplayName)
      throw new counterpartyError.InvalidName({ displayName });
    validateAddress(meta.employer.address, true);
  }
  if (meta.vendor) validateAddress(meta.vendor.address, false);
  if (meta.contractor) validateAddress(meta.contractor.address, true);
}

const counterpartyMetaValidation = Object.freeze({ validate, validateCreate });
export default counterpartyMetaValidation;
