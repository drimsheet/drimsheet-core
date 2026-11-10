import { ValidateError } from 'tsoa';

/**
 * Converts TSOA field errors into the HTTP validation-error list.
 */
export default function parseTsoaValidationErrorHelper(error: ValidateError) {
  return Object.entries(error.fields).map(([key, value]) => ({
    field: key,
    message: value.message,
  }));
}
