import { IApiValidationError } from '@shared/types/error.types';
import appError from '@shared/values/errors/app.error';
import { IHttpErrorDto } from '@shared/values/errors/error.dto';

/**
 * Builds the HTTP error response from a recognized application error.
 */
export default function toHttpErrorDtoHelper(
  error: InstanceType<typeof appError.Base>,
  validationErrors?: IApiValidationError[]
): IHttpErrorDto {
  return {
    name: error.name,
    errorKey: error.errorKey,
    cause: error.cause,
    validationErrors,
  };
}
