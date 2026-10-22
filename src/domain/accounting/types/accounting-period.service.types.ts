import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

export default interface IAccountingPeriodService {
  /**
   * Requires exactly one covering Open period; rejects missing, ambiguous,
   * or Closed periods. Period ends are exclusive.
   */
  validatePostingPeriod(
    accountingEntityId: TEntityId,
    postingDate: Date,
    repoOptions: IReadRepoOptions
  ): Promise<void>;
}
