import { IWriteRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

export default interface IOutboxAppService {
  createBalancePropagation(
    journalEntryId: TEntityId,
    options: IWriteRepoOptions
  ): Promise<void>;
}
