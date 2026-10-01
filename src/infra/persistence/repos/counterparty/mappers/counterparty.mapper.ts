import { InferSelectModel } from 'drizzle-orm';

import { TEntityId } from '@shared/types/uuid';
import deepFreeze from '@shared/utils/deep-freeze';

import getCounterpartyRolesHelper from '@domain/counterparty/entities/helpers/get-counterparty-roles.helper';
import {
  ICounterparty,
  ICounterpartyMeta,
  UCounterpartyStatus,
  UCounterpartyType,
} from '@domain/counterparty/types/counterparty.types';

import { counterpartiesInCore } from '@infra/config/drizzle/schema';
import {
  fromRepoDate,
  toRepoDate,
} from '@infra/persistence/helpers/date.mapper';

export interface ICounterpartyModel extends InferSelectModel<
  typeof counterpartiesInCore
> {}

const counterpartyMapper = {
  toRepo(entity: ICounterparty): ICounterpartyModel {
    return {
      createdBy: entity.createdBy as TEntityId,
      id: entity.id,
      version: entity.version,
      accountingEntityId: entity.accountingEntityId,
      name: entity.name,
      status: entity.status,
      type: entity.type,
      meta: structuredClone(entity.meta),
      createdAt: toRepoDate(entity.createdAt),
      updatedAt: toRepoDate(entity.updatedAt),
    };
  },

  toDomain(payload: ICounterpartyModel): ICounterparty {
    const meta = structuredClone(payload.meta) as ICounterpartyMeta;
    return deepFreeze({
      createdBy: payload.createdBy as TEntityId,
      id: payload.id as TEntityId,
      version: payload.version,
      accountingEntityId: payload.accountingEntityId as TEntityId,
      name: payload.name,
      status: payload.status as UCounterpartyStatus,
      type: payload.type as UCounterpartyType,
      roles: getCounterpartyRolesHelper(meta),
      meta,
      createdAt: fromRepoDate(payload.createdAt),
      updatedAt: fromRepoDate(payload.updatedAt),
    });
  },
};

export default counterpartyMapper;
