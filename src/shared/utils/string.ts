import { v7 as uuid } from 'uuid';
import { z } from 'zod';

import { TErrorConstructor } from '@shared/types/error.types';
import { TEntityId } from '@shared/types/uuid';

interface IValidationOptions {
  min: number;
  max: number;
  sanitize?: boolean;
}

function isString(value: string) {
  return typeof value === 'string';
}

function isNonEmptyString(value: string) {
  return isString(value) && value.trim().length > 0;
}

function validateIsNonEmptyString<T extends Error>(
  value: string,
  ErrorClass: TErrorConstructor<T>
) {
  if (!isNonEmptyString(value)) {
    throw new ErrorClass({ value });
  }
}

function isStringWithinRange(value: string, options: IValidationOptions) {
  if (!isString(value)) {
    return false;
  }
  const schema = z.string().min(options.min).max(options.max);
  const result = schema.safeParse(options.sanitize ? value.trim() : value);

  if (!result.success) {
    return false;
  }

  return true;
}

function validateStringWithinRange<T extends Error>(
  value: string,
  options: IValidationOptions,
  ErrorClass: TErrorConstructor<T>
) {
  if (!isStringWithinRange(value, options)) {
    throw new ErrorClass({ value });
  }
}

// TODO: Rename this value-returning validation to a check; reserve validate
// for checks that only throw on failure and return no value.
function sanitizeAndValidateString<T extends Error>(
  value: string,
  options: IValidationOptions,
  ErrorClass: TErrorConstructor<T>
) {
  if (!isString(value)) {
    throw new ErrorClass({ value });
  }
  const schema = z.string().min(options.min).max(options.max);
  const result = schema.safeParse(value.trim());

  if (!result.success) {
    throw new ErrorClass({ value });
  }

  return result.data;
}

function isUUID(value: string) {
  return z.uuid().safeParse(value).success;
}

function validateUUID<T extends Error>(
  value: string,
  ErrorClass: TErrorConstructor<T>
) {
  if (!isUUID(value)) {
    throw new ErrorClass({ value });
  }
}

function isNumeric(value: string) {
  return /^[0-9]+$/.test(value);
}

function isUrl(value: string) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function toUUD<T extends Error>(
  value: string,
  ErrorClass: TErrorConstructor<T>
): TEntityId {
  validateUUID(value, ErrorClass);
  return value as TEntityId;
}

function generateUUID(): TEntityId {
  return uuid() as TEntityId;
}

function validateIsInEnum<T extends Error>(
  value: string,
  enums: object,
  ErrorClass: TErrorConstructor<T>
) {
  const isInArray = Object.values(enums).includes(value);
  if (!isInArray) {
    throw new ErrorClass({ value });
  }
}

const stringUtils = Object.freeze({
  sanitizeAndValidate: sanitizeAndValidateString,
  isUUID,
  isNonEmptyString,
  validateIsNonEmptyString,
  validateUUID,
  generateUUID,
  toUUD,
  isNumeric,
  isUrl,
  isStringWithinRange,
  validateStringWithinRange,
  validateIsInEnum,
});

export default stringUtils;
