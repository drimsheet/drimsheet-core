import { TEntityId } from '@shared/types/uuid';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';

import accountingEntityMapper, {
  IAccountingEntityModel,
} from '@infra/persistence/repos/accounting/mappers/accounting-entity.mapper';

describe('Accounting Entity Mapper', () => {
  const createdAt = new Date('2026-04-10T12:00:00Z');
  const updatedAt = new Date('2026-04-10T12:30:00Z');

  const domainEntity: IAccountingEntity = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: 'entity-1' as TEntityId,
    ownerId: 'user-1' as TEntityId,
    name: 'Drimsheet Corp',
    type: 'private_company',
    status: 'active',
    functionalCurrencyCode: 'NGN',
    jurisdictionCode: 'NG',
    createdAt,
    updatedAt,
  };

  const repoModel: IAccountingEntityModel = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: 'entity-1',
    ownerId: 'user-1',
    name: 'Drimsheet Corp',
    type: 'private_company',
    status: 'active',
    functionalCurrencyCode: 'NGN',
    jurisdictionCode: 'NG',
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };

  describe('toRepo', () => {
    it('should map a domain accounting entity to a repo model', () => {
      expect(accountingEntityMapper.toRepo(domainEntity)).toEqual(repoModel);
    });
  });

  describe('toDomain', () => {
    it('should map a repo model to a domain accounting entity', () => {
      expect(accountingEntityMapper.toDomain(repoModel)).toEqual(domainEntity);
    });
  });

  describe('toInterface', () => {
    it('should map domain accounting entity to interface representation', () => {
      const interfaceEntity = accountingEntityMapper.toInterface(domainEntity);

      expect(interfaceEntity.id).toBe(domainEntity.id);
      expect(interfaceEntity.type).toBe('private_company');
      expect(interfaceEntity.name).toBe('Drimsheet Corp');
    });
  });
});
