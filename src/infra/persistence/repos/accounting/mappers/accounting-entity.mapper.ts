import { InferSelectModel } from 'drizzle-orm';

import { TEntityId } from '@shared/types/uuid';

import { UJurisdictionCode } from '@domain/accounting/config/jurisdictions.config';
import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { UCurrencyCode } from '@domain/money/config/currencies.config';

import { accountingEntitiesInCore } from '@infra/config/drizzle/schema';

export type IAccountingEntityRes = IAccountingEntity;

export interface IAccountingEntityModel extends InferSelectModel<
  typeof accountingEntitiesInCore
> {}

const accountingEntityMapper = {
  toRepo(entity: IAccountingEntity): IAccountingEntityModel {
    return {
      createdBy: entity.createdBy as TEntityId,
      id: entity.id,
      ownerId: entity.ownerId,
      name: entity.name,
      status: entity.status,
      type: entity.type,
      functionalCurrencyCode: entity.functionalCurrencyCode,
      jurisdictionCode: entity.jurisdictionCode,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  },

  toDomain(payload: IAccountingEntityModel): IAccountingEntity {
    return Object.freeze({
      createdBy: payload.createdBy as TEntityId,
      id: payload.id as TEntityId,
      ownerId: payload.ownerId as TEntityId,
      name: payload.name,
      status: payload.status,
      type: payload.type,
      functionalCurrencyCode: payload.functionalCurrencyCode as UCurrencyCode,
      jurisdictionCode: payload.jurisdictionCode as UJurisdictionCode,
      createdAt: new Date(payload.createdAt),
      updatedAt: new Date(payload.updatedAt),
    });
  },

  toInterface(payload: IAccountingEntity): IAccountingEntityRes {
    return {
      ...payload,
    };
  },
};

export default accountingEntityMapper;
