import { TErrorCause, TErrorKeys } from '@shared/types/error.types';
import errorUtils from '@shared/utils/error';
import appError from '@shared/values/errors/app.error';

const EErrorKeys = {
  InvalidUploadPurpose: 'app_error_file_upload_purpose_invalid',
  InvalidUploadReference: 'app_error_file_upload_reference_invalid',
  InvalidUploadCount: 'app_error_file_upload_count_invalid',
  InvalidUploadType: 'app_error_file_upload_type_invalid',
  InvalidUploadSize: 'app_error_file_upload_size_invalid',
  UploadUnexpected: 'app_error_file_upload_unexpected',
  DownloadUnexpected: 'app_error_file_download_unexpected',
  ReadUnexpected: 'app_error_file_read_unexpected',
  ClaimUnexpected: 'app_error_file_claim_unexpected',
  DeleteUnexpected: 'app_error_file_delete_unexpected',
} as const satisfies TErrorKeys<'app_error_file'>;

type UFileError = (typeof EErrorKeys)[keyof typeof EErrorKeys];

class FileAppError extends appError.Base<UFileError> {
  constructor(key: UFileError, cause?: TErrorCause) {
    super(key, cause);
    this.name = 'FileAppError';
  }
}

const fileAppError = Object.freeze({
  Base: FileAppError,
  ...errorUtils.getMappedErrors(EErrorKeys, FileAppError),
});

export default fileAppError;
