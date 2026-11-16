import { TErrorCause, TErrorKeys } from '@shared/types/error.types';
import errorUtils from '@shared/utils/error';
import appError from '@shared/values/errors/app.error';

const EErrorKeys = {
  InvalidConfidence: 'app_error_ai_confidence_invalid',
  InvalidEvidence: 'app_error_ai_evidence_invalid',
  InvalidTemporaryId: 'app_error_ai_temporary_id_invalid',
} as const satisfies TErrorKeys<'app_error_ai'>;

type UAiAppError = (typeof EErrorKeys)[keyof typeof EErrorKeys];

class AiAppError extends appError.Base<UAiAppError> {
  constructor(key: UAiAppError, cause?: TErrorCause) {
    super(key, cause);
    this.name = 'AiAppError';
  }
}

const aiAppError = Object.freeze({
  Base: AiAppError,
  ...errorUtils.getMappedErrors(EErrorKeys, AiAppError),
});

export default aiAppError;
