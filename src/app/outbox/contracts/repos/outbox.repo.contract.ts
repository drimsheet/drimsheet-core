import {
  ICreateOutbox,
  IOutbox,
  UOutboxType,
} from '@shared/types/outbox.types';
import { IReadRepoOptions, IWriteRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

export default interface IOutboxRepo {
  create(outbox: ICreateOutbox, options: IWriteRepoOptions): Promise<void>;

  findByIdAndType(
    id: TEntityId,
    type: UOutboxType,
    options: IReadRepoOptions
  ): Promise<IOutbox | null>;

  delete(id: TEntityId, options: IWriteRepoOptions): Promise<boolean>;
}
