import { IPaginationParams } from '@shared/values/pagination/types/pagination.types';

import { ICorrelationId } from './correlation-id.types';

export interface ITransactionContext {
  _brand?: 'DrimsheetTransactionContext';
}

export interface IRepoOptions extends ICorrelationId {
  tx?: ITransactionContext;
}

export const ERepoLock = Object.freeze({
  Update: 'update',
  NoKeyUpdate: 'no key update',
  Share: 'share',
  KeyShare: 'key share',
} as const);

export type URepoLock = (typeof ERepoLock)[keyof typeof ERepoLock];

export interface IReadRepoOptions extends IRepoOptions {
  /** Lock mode for supported reads. Requires a caller-owned transaction. */
  lock?: URepoLock;
}

export interface IPaginatedReadRepoOptions
  extends IReadRepoOptions, IPaginationParams {}

export type IWriteRepoOptions<THistory = never> = IRepoOptions &
  ([THistory] extends [never] ? object : { history: THistory });

export type IVersionedRepoWriteOptions<THistory = never> =
  IWriteRepoOptions<THistory> & {
    expectedVersion: number;
  };
