import { TEntityId } from '@shared/types/uuid';

import {
  ELedgerAccountStatus,
  ILedgerAccount,
} from '@domain/ledger/types/ledger.types';

import ledgerAccountMapper, {
  ILedgerAccountModel,
} from '@infra/persistence/repos/ledger/mappers/ledger-account.mapper';

describe('Ledger Account Mapper', () => {
  const createdAt = new Date('2026-04-10T12:00:00Z');
  const updatedAt = new Date('2026-04-10T12:30:00Z');

  const domainLedgerAccount: ILedgerAccount = {
    id: 'account-1' as TEntityId,
    version: 1,
    code: '1000',
    materializedPath: '1000',
    accountingEntityId: 'entity-1' as TEntityId,

    type: 'asset',
    normalBalance: 'debit',
    subType: 'CASH_AND_CASH_EQUIVALENTS',
    behavior: 'POSTING',
    isControlAccount: false,
    controlAccountId: null,
    name: 'Cash',
    currency: {
      code: 'USD',
      symbol: '$',
      name: 'US Dollar',
      minorUnit: 2,
    },
    status: 'active',
    contraAccountRule: 'contra_not_applicable',
    adjunctAccountRule: 'adjunct_not_applicable',
    meta: { description: 'Main cash account' },
    openingBalanceDate: null,
    createdBy: 'user-1' as TEntityId,
    createdAt,
    updatedAt,
    deletedAt: null,
  };

  const repoModel: ILedgerAccountModel = {
    id: 'account-1',
    version: 1,
    code: '1000',
    materializedPath: '1000',
    accountingEntityId: 'entity-1',

    type: 'asset',
    normalBalance: 'debit',
    subType: 'CASH_AND_CASH_EQUIVALENTS',
    behavior: 'POSTING',
    isControlAccount: false,
    controlAccountId: null,
    name: 'Cash',
    currencyCode: 'USD',
    status: 'active',
    contraAccountRule: 'contra_not_applicable',
    adjunctAccountRule: 'adjunct_not_applicable',
    meta: { description: 'Main cash account' },
    openingBalanceDate: null,
    createdBy: 'user-1',
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    deletedAt: null,
  };

  const currencyRepoModel = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    minorUnit: 2,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    deletedAt: null,
  };

  it.each([
    '123e4567-e89b-42d3-a456-426614174000' as TEntityId,
    '123e4567-e89b-42d3-a456-426614174001' as TEntityId,
    'b2222222-2222-4222-8222-222222222222' as TEntityId,
    'c3333333-3333-4333-8333-333333333333' as TEntityId,
  ])(
    'round-trips complete $type attribution through JSON storage',
    async (createdBy) => {
      const model = ledgerAccountMapper.toRepo({
        ...domainLedgerAccount,
        createdBy,
      });
      const restored = ledgerAccountMapper.toDomain({
        ...model,
        currency: currencyRepoModel,
        createdBy: JSON.parse(JSON.stringify(model.createdBy)),
      });
      expect(restored.createdBy).toEqual(createdBy);
    }
  );

  it('round-trips a Draft subaccount through persistence mapping', () => {
    const draftAccount: ILedgerAccount = {
      ...domainLedgerAccount,
      code: '100001',
      materializedPath: '100000.100001',
      controlAccountId: 'c3333333-3333-4333-8333-333333333333' as TEntityId,
      status: ELedgerAccountStatus.Draft,
    };

    const model = ledgerAccountMapper.toRepo(draftAccount);
    const restored = ledgerAccountMapper.toDomain({
      ...model,
      currency: currencyRepoModel,
    });

    expect(model.status).toBe(ELedgerAccountStatus.Draft);
    expect(restored).toEqual(draftAccount);
  });

  describe('toRepo', () => {
    it('should map a domain ledger account to a repo model', () => {
      expect(ledgerAccountMapper.toRepo(domainLedgerAccount)).toEqual(
        repoModel
      );
    });
    it('should map a domain ledger account with openingBalanceDate to a repo model', () => {
      const openingDate = new Date('2026-01-01T00:00:00.000Z');
      const domainWithDate = {
        ...domainLedgerAccount,
        openingBalanceDate: openingDate,
      };
      const mapped = ledgerAccountMapper.toRepo(domainWithDate);
      expect(mapped.openingBalanceDate).toBe('2026-01-01');
    });

    it('maps a null-currency account to a null currency code', () => {
      expect(
        ledgerAccountMapper.toRepo({ ...domainLedgerAccount, currency: null })
          .currencyCode
      ).toBeNull();
    });
  });

  describe('toDomain', () => {
    it('should map a repo model to a domain ledger account', () => {
      const payload: Parameters<typeof ledgerAccountMapper.toDomain>[0] = {
        ...repoModel,
        currency: currencyRepoModel,
      };
      expect(ledgerAccountMapper.toDomain(payload)).toEqual(
        domainLedgerAccount
      );
    });

    it('should map a repo model with openingBalanceDate to a domain ledger account', () => {
      const payload: Parameters<typeof ledgerAccountMapper.toDomain>[0] = {
        ...repoModel,
        openingBalanceDate: '2026-01-01',
        currency: currencyRepoModel,
      };
      const domain = ledgerAccountMapper.toDomain(payload);
      expect(domain.openingBalanceDate).toEqual(new Date('2026-01-01'));
    });

    it('maps an absent currency relation to a null domain currency', () => {
      const payload: Parameters<typeof ledgerAccountMapper.toDomain>[0] = {
        ...repoModel,
        currencyCode: null,
        currency: null,
      };

      expect(ledgerAccountMapper.toDomain(payload).currency).toBeNull();
    });
  });
});
