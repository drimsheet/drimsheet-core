import { IReadRepoOptions, IWriteRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { IAccountingEntityAuditHistory } from '@domain/accounting/types/accounting-entity-audit.types';
import {
  IAccountingEntity,
  UAccountingEntityStatus,
  UAccountingEntityType,
} from '@domain/accounting/types/accounting-entity.types';

export default interface IAccountingEntityRepo {
  create(
    domain: IAccountingEntity,
    options: IWriteRepoOptions<IAccountingEntityAuditHistory>
  ): Promise<void>;

  update(
    domain: IAccountingEntity,
    options: IWriteRepoOptions<IAccountingEntityAuditHistory>
  ): Promise<void>;

  findById(
    id: TEntityId,
    options: IReadRepoOptions
  ): Promise<IAccountingEntity | null>;

  /** Selects an active entity owned by the user. */
  findByIdAndUserId(
    id: TEntityId,
    userId: TEntityId,
    options: IReadRepoOptions
  ): Promise<IAccountingEntity | null>;

  findByUserId(
    userId: TEntityId,
    options: IReadRepoOptions & { status?: UAccountingEntityStatus },
    type?: UAccountingEntityType
  ): Promise<IAccountingEntity[]>;
}
