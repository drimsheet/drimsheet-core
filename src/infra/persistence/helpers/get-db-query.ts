import { IReadRepoOptions } from '@shared/types/repo.types';
import repoError from '@shared/values/errors/repo.error';

import { postgres } from '@infra/config/postgres.config';

export default function getDbQuery(options: IReadRepoOptions) {
  const isLockWithoutTransaction = options.lock && !options.tx;
  if (isLockWithoutTransaction) throw new repoError.TransactionRequired();

  return (options.tx ?? postgres) as typeof postgres;
}
