import { IRepoOptions, ITransactionContext } from '@shared/types/repo.types';

export default function passOnRepoTransactionHelper(
  options: IRepoOptions,
  tx: unknown
) {
  return {
    ...options,
    tx: tx as ITransactionContext,
  };
}
