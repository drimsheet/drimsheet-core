import { IParsedError, TErrorKey } from '@shared/types/error.types';
import { IHttpErrorDto } from '@shared/values/errors/error.dto';

/**
 * Builds the HTTP error response using the recognized parsed error key.
 */
export default function parsedErrorToHttpErrorDtoHelper(
  error: IParsedError,
  recognizedErrorKey: TErrorKey
): IHttpErrorDto {
  return {
    name: error.name,
    errorKey: recognizedErrorKey,
    cause: error.cause,
    validationErrors: error.validationErrors,
  };
}
