import { TErrorCause, TErrorKey, TErrorKeys } from '@shared/types/error.types';
import errorUtils from '@shared/utils/error';

import DomainError from './domain.error';

type TErrorPrefix = TErrorKey<'repo_error'>;

const EErrorKeys = {
  TransactionRequired: 'repo_error_transaction_required_unexpected',
  TransactionInactive: 'repo_error_transaction_inactive_unexpected',
  TransactionCommitFailed: 'repo_error_transaction_commit_failed_unexpected',
  TransactionCleanupFailed: 'repo_error_transaction_cleanup_failed_unexpected',
  VersionNotFound: 'repo_error_version_conflict',
  VersionRequired: 'repo_error_version_required_unexpected',
  VersionMismatch: 'repo_error_version_mismatch_unexpected',
  MissingHistory: 'repo_error_missing_history_unexpected',
} as const satisfies TErrorKeys<'repo_error'>;

class RepoError extends DomainError<TErrorPrefix> {
  constructor(key: TErrorPrefix, cause?: TErrorCause) {
    super(key, cause);
    this.name = 'RepoError';
  }
}

const repoError = Object.freeze({
  Base: RepoError,
  ...errorUtils.getMappedErrors(EErrorKeys, RepoError),
});

export default repoError;
