import { ITransactionContext } from '@shared/types/repo.types';

export type TRepoTransactionFn<T = void> = (
  tx: ITransactionContext
) => Promise<T>;

/**
 * Caller-owned transaction. Await queries, commit, and disposal sequentially.
 * Do not reuse its context or retained queries after commit or disposal.
 */
export interface IRepoTransaction {
  /** Pass only this context to repositories and services joining the transaction. */
  readonly context: ITransactionContext;

  /**
   * Commit once and dispose after success. Pass { dispose: false } to retain the
   * client for explicit disposal; the committed context cannot be reused.
   * On failure, use handleError or a finally disposal to release the client.
   */
  commit(options?: { dispose?: boolean }): Promise<void>;

  /**
   * Dispose and rethrow the error. Only unfinished work is rolled back; failures
   * after commit never roll back. Cleanup failures retain both errors.
   */
  handleError(error: unknown): Promise<never>;

  /**
   * Roll back unfinished work and release the client exactly once. Failed commits
   * or rollback failures discard the client. Pass the caught operation error so
   * a cleanup failure retains it alongside the cleanup error. Calls after release
   * are no-ops. Always await outstanding queries and commit before disposing.
   */
  dispose(operationError?: unknown): Promise<void>;
}

export interface IRepoService {
  /**
   * Begin a caller-owned transaction. Use finally disposal, or a disposing commit
   * on every successful path with handleError in catch.
   * Rejects on acquisition/initialization failure and cleans up acquired clients.
   */
  createTransaction(): Promise<IRepoTransaction>;

  runInTransaction<T>(
    fn: TRepoTransactionFn<T>,
    tx?: ITransactionContext
  ): Promise<T>;
}
