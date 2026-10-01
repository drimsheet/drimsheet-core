import stringUtils from '@shared/utils/string';
import { IAddress } from '@shared/values/contact-details/types/address.types';

import addressError from './address.error';

export type TCreateAddressPayload = {
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postalCode?: string | null;
  countryCode: string;
};

// TODO: Rename this value-returning validation to a check; reserve validate
// for checks that only throw on failure and return no value.
function validateLine1(line1: string): string {
  return stringUtils.sanitizeAndValidate(
    line1,
    { min: 1, max: 255 },
    addressError.InvalidLine1
  );
}

// TODO: Rename this value-returning validation to a check; reserve validate
// for checks that only throw on failure and return no value.
function validateCity(city: string): string {
  return stringUtils.sanitizeAndValidate(
    city,
    { min: 1, max: 100 },
    addressError.InvalidCity
  );
}

// TODO: Rename this value-returning validation to a check; reserve validate
// for checks that only throw on failure and return no value.
function validateCountryCode(countryCode: string): string {
  const sanitized = stringUtils
    .sanitizeAndValidate(
      countryCode,
      { min: 2, max: 2 },
      addressError.InvalidCountryCode
    )
    .toUpperCase();

  if (!/^[A-Z]{2}$/.test(sanitized)) {
    throw new addressError.InvalidCountryCode({ countryCode });
  }

  return sanitized;
}

function sanitizeOptionalString(value?: string | null): string | null {
  if (
    value === undefined ||
    value === null ||
    !stringUtils.isNonEmptyString(value)
  ) {
    return null;
  }
  return value.trim();
}

function make(payload: TCreateAddressPayload): Readonly<IAddress> {
  if (!payload || typeof payload !== 'object') {
    throw new addressError.InvalidAddress({ address: payload });
  }

  const line1 = validateLine1(payload.line1);
  const city = validateCity(payload.city);
  const countryCode = validateCountryCode(payload.countryCode);

  const line2 = sanitizeOptionalString(payload.line2);
  const region = sanitizeOptionalString(payload.region);
  const postalCode = sanitizeOptionalString(payload.postalCode);

  return Object.freeze({
    line1,
    line2,
    city,
    region,
    postalCode,
    countryCode,
  });
}

function validate(address: IAddress): void {
  if (!address || typeof address !== 'object') {
    throw new addressError.InvalidAddress({ address });
  }

  validateLine1(address.line1);
  validateCity(address.city);
  validateCountryCode(address.countryCode);
}

const addressValue = Object.freeze({
  make,
  validate,
});

export default addressValue;
