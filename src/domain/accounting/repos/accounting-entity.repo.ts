import {
  IReadRepoOptions,
  ITransactionContext,
  IWriteRepoOptions,
} from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { IAccountingEntityAuditHistory } from '@domain/accounting/types/accounting-entity-audit.types';
import {
  IAccountingEntity,
  UAccountingEntityType,
} from '@domain/accounting/types/accounting-entity.types';

export default interface IAccountingEntityRepo {
  /** Locks the entity until the supplied transaction commits or rolls back. */
  findByIdForUpdate(
    id: TEntityId,
    options: IReadRepoOptions & { tx: ITransactionContext }
  ): Promise<IAccountingEntity | null>;

  create(
    domain: IAccountingEntity,
    options: IWriteRepoOptions<IAccountingEntityAuditHistory>
  ): Promise<void>;

  findById(
    id: TEntityId,
    options: IReadRepoOptions
  ): Promise<IAccountingEntity | null>;

  findByIdAndUserId(
    id: TEntityId,
    userId: TEntityId,
    options: IReadRepoOptions
  ): Promise<IAccountingEntity | null>;

  findByUserId(
    userId: TEntityId,
    options: IReadRepoOptions,
    type?: UAccountingEntityType
  ): Promise<IAccountingEntity[]>;
}
