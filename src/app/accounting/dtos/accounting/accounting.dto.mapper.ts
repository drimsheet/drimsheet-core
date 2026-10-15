import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';

import { IAccountingEntityDto } from './accounting.dto';

const accountingEntityDtoMapper = Object.freeze({
  toDto(entity: IAccountingEntity): IAccountingEntityDto {
    return {
      id: entity.id,
      createdBy: entity.createdBy,
      ownerId: entity.ownerId,
      name: entity.name,
      type: entity.type,
      functionalCurrencyCode: entity.functionalCurrencyCode,
      jurisdictionCode: entity.jurisdictionCode,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  },
});
export default accountingEntityDtoMapper;
