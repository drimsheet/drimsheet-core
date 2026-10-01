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

  /** Commit once. Always await dispose afterward, including when commit rejects. */
  commit(): Promise<void>;

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
   * Begin a caller-owned transaction. The caller must dispose it in finally.
   * Rejects on acquisition/initialization failure and cleans up acquired clients.
   */
  createTransaction(): Promise<IRepoTransaction>;

  runInTransaction<T>(
    fn: TRepoTransactionFn<T>,
    tx?: ITransactionContext
  ): Promise<T>;
}
