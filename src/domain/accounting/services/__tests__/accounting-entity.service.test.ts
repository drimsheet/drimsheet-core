import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';
import IAccountingEntityRepo from '@domain/accounting/repos/accounting-entity.repo';
import makeAccountingEntityService from '@domain/accounting/services/accounting-entity.service';
import {
  EAccountingEntityType,
  IAccountingEntity,
} from '@domain/accounting/types/accounting-entity.types';
import IJournalEntryRepo from '@domain/journal-entry/repos/journal-entry.repo';
import ledgerAccountBalanceEntity from '@domain/ledger/entities/ledger-account-balance.entity';
import ledgerAccountBalanceError from '@domain/ledger/errors/ledger-account-balance.error';
import ILedgerAccountBalanceRepo from '@domain/ledger/repos/ledger-account-balance.repo';
import currencyEntity from '@domain/money/entities/currency.entity';

describe('accountingEntityService', () => {
  const repoOptions: IReadRepoOptions = { correlationId: 'correlation-id' };
  const accountingEntityRepo: jest.Mocked<IAccountingEntityRepo> = {
    delete: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndUserId: jest.fn(),
    findByUserId: jest.fn(),
  };
  const journalEntryRepo: jest.Mocked<IJournalEntryRepo> = {
    existsByAccountingEntityId: jest.fn(),
    existsByAccountId: jest.fn(),
    existsPostedByAccountId: jest.fn(),
    findAllByAccountIds: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findById: jest.fn(),
  };
  const ledgerAccountBalanceRepo: jest.Mocked<ILedgerAccountBalanceRepo> = {
    create: jest.fn(),
    update: jest.fn(),
    adjustBalance: jest.fn(),
    findByAccountId: jest.fn(),
    findAdjustmentsByAccountId: jest.fn(),
    createWithAdjustments: jest.fn(),
    findAllByAccountingEntityId: jest.fn(),
    findAllByAccountIds: jest.fn(),
  };
  const service = makeAccountingEntityService({
    accountingEntityRepo,
    ledgerAccountBalanceRepo,
    journalEntryRepo,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    ledgerAccountBalanceRepo.findAllByAccountingEntityId.mockResolvedValue([]);
    journalEntryRepo.existsByAccountingEntityId.mockResolvedValue(false);
    accountingEntityRepo.findByUserId.mockResolvedValue([]);
  });

  describe('create', () => {
    const input = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      ownerId: '123e4567-e89b-12d3-a456-426614174000' as TEntityId,
      name: 'Standalone',
      type: EAccountingEntityType.Individual,
      functionalCurrencyCode: 'NGN' as const,
      jurisdictionCode: 'NG' as const,
    };

    it.each(Object.values(EAccountingEntityType))(
      'creates only a %s entity, event, and audit',
      async (type) => {
        const [entity, events, audit] = await service.create(
          { ...input, type },
          repoOptions
        );
        expect(entity).toMatchObject({ ...input, type });
        expect(Object.isFrozen(entity)).toBe(true);
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
          type: 'domain:accounting:entity:created',
          data: entity,
        });
        expect(audit).toMatchObject({ diff: { before: null, after: entity } });
        expect(accountingEntityRepo.create).not.toHaveBeenCalled();
      }
    );

    it.each(['active', 'archived'] as const)(
      'rejects another Individual in the same jurisdiction when existing is %s (ACC-AE-005)',
      async (status) => {
        const [existing] = accountingEntityEntity.make(input);
        accountingEntityRepo.findByUserId.mockResolvedValue([
          status === 'archived'
            ? accountingEntityEntity.archive(existing)[0]
            : existing,
        ]);
        await expect(service.create(input, repoOptions)).rejects.toMatchObject({
          errorKey:
            'accounting_error_accounting_entity_individual_already_exists_in_jurisdiction_conflict',
          cause: {
            ownerId: input.ownerId,
            jurisdictionCode: input.jurisdictionCode,
          },
        });
        expect(accountingEntityRepo.findByUserId).toHaveBeenCalledWith(
          input.ownerId,
          repoOptions,
          EAccountingEntityType.Individual
        );
      }
    );

    it.each(['active', 'archived'] as const)(
      'allows another jurisdiction when the existing Individual is %s (ACC-AE-005)',
      async (status) => {
        const [existing] = accountingEntityEntity.make({
          ...input,
          jurisdictionCode: 'US',
        });
        accountingEntityRepo.findByUserId.mockResolvedValue([
          status === 'archived'
            ? accountingEntityEntity.archive(existing)[0]
            : existing,
        ]);

        const [entity] = await service.create(input, repoOptions);
        expect(entity).toMatchObject(input);
      }
    );

    it('scopes the existing-entity lookup to the requested owner (ACC-AE-005)', async () => {
      const otherOwner = '123e4567-e89b-12d3-a456-426614174099' as TEntityId;
      const [existing] = accountingEntityEntity.make(input);
      accountingEntityRepo.findByUserId.mockImplementation(async (ownerId) =>
        ownerId === input.ownerId ? [existing] : []
      );

      const [entity] = await service.create(
        { ...input, ownerId: otherOwner },
        repoOptions
      );
      expect(entity.ownerId).toBe(otherOwner);
      expect(entity.jurisdictionCode).toBe(input.jurisdictionCode);
    });

    it.each([
      EAccountingEntityType.SoleTrader,
      EAccountingEntityType.PrivateCompany,
    ])(
      'allows a %s alongside an Individual in the same jurisdiction',
      async (type) => {
        accountingEntityRepo.findByUserId.mockResolvedValue([
          accountingEntityEntity.make(input)[0],
        ]);
        const [entity] = await service.create({ ...input, type }, repoOptions);
        expect(entity.type).toBe(type);
        expect(accountingEntityRepo.findByUserId).not.toHaveBeenCalled();
      }
    );

    it.each([
      { name: '' },
      { name: ' '.repeat(5) },
      { name: 'a'.repeat(101) },
      { type: 'invalid' },
      { jurisdictionCode: 'ZZ' },
      { functionalCurrencyCode: 'ZZZ' },
      { ownerId: 'invalid' },
      { createdBy: 'invalid' },
    ])('retains entity validation for %j', async (changes) => {
      await expect(
        service.create({ ...input, ...changes } as typeof input, repoOptions)
      ).rejects.toThrow();
      expect(accountingEntityRepo.create).not.toHaveBeenCalled();
    });

    it('propagates uniqueness-read failures', async () => {
      const failure = new Error('read failed');
      accountingEntityRepo.findByUserId.mockRejectedValueOnce(failure);
      await expect(service.create(input, repoOptions)).rejects.toBe(failure);
    });
  });

  describe('delete', () => {
    const [entity] = accountingEntityEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      ownerId: '123e4567-e89b-12d3-a456-426614174000' as TEntityId,
      name: 'Business',
      type: 'sole_trader',
      functionalCurrencyCode: 'NGN',
      jurisdictionCode: 'NG',
    });

    it('permits deletion only when no journal entries exist (ACC-AE-007)', async () => {
      const [deletedEntity, deleteEvent, audit] = await service.delete(
        entity,
        repoOptions
      );
      expect(deletedEntity).toBe(entity);
      expect(deleteEvent).toMatchObject({
        type: 'domain:accounting:entity:deleted',
        data: entity,
      });
      expect(audit).toBeNull();
      expect(journalEntryRepo.existsByAccountingEntityId).toHaveBeenCalledWith(
        entity.id,
        repoOptions
      );
      expect(accountingEntityRepo.delete).not.toHaveBeenCalled();
    });

    it.each(['active', 'archived'] as const)(
      'rejects journal references for a %s entity without preparing an archive',
      async (status) => {
        const current =
          status === 'archived'
            ? accountingEntityEntity.archive(entity)[0]
            : entity;
        journalEntryRepo.existsByAccountingEntityId.mockResolvedValue(true);
        await expect(
          service.delete(current, repoOptions)
        ).rejects.toBeInstanceOf(
          accountingEntityError.DeletionWithJournalEntries
        );
        expect(
          journalEntryRepo.existsByAccountingEntityId
        ).toHaveBeenCalledWith(current.id, repoOptions);
        expect(accountingEntityRepo.update).not.toHaveBeenCalled();
        expect(accountingEntityRepo.delete).not.toHaveBeenCalled();
      }
    );

    it('propagates eligibility read failures without authorizing deletion', async () => {
      const failure = new Error('read failed');
      journalEntryRepo.existsByAccountingEntityId.mockRejectedValueOnce(
        failure
      );
      await expect(service.delete(entity, repoOptions)).rejects.toBe(failure);
    });
  });

  describe('update', () => {
    const [entity] = accountingEntityEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      ownerId: '123e4567-e89b-12d3-a456-426614174000' as TEntityId,
      name: 'Business',
      type: 'sole_trader',
      functionalCurrencyCode: 'NGN',
      jurisdictionCode: 'NG',
    });

    it('checks persisted eligibility and returns the entity transition without persisting', async () => {
      journalEntryRepo.existsByAccountingEntityId.mockResolvedValue(false);
      const response = await service.update(
        entity,
        {
          name: 'Updated',
          type: 'private_company',
          functionalCurrencyCode: 'USD',
        },
        repoOptions
      );
      const [updated, events, audit] = response.accountingEntity;
      expect(response.updatedBalances).toEqual([]);
      expect(updated).toMatchObject({
        id: entity.id,
        name: 'Updated',
        type: 'private_company',
        functionalCurrencyCode: 'USD',
      });
      expect(events).toHaveLength(1);
      expect(audit).not.toBeNull();
      expect(journalEntryRepo.existsByAccountingEntityId).toHaveBeenCalledWith(
        entity.id,
        repoOptions
      );
      expect(accountingEntityRepo.update).not.toHaveBeenCalled();
    });

    it('rejects an ineligible currency change before applying entity validation or mutation', async () => {
      journalEntryRepo.existsByAccountingEntityId.mockResolvedValue(true);
      // The invalid name would fail entity.update if the entity transition ran first.
      await expect(
        service.update(
          entity,
          { name: '', functionalCurrencyCode: 'USD' },
          repoOptions
        )
      ).rejects.toThrow(
        accountingEntityError.FunctionalCurrencyChangeNotAllowed
      );
      expect(
        ledgerAccountBalanceRepo.findAllByAccountingEntityId
      ).not.toHaveBeenCalled();
      expect(entity.name).toBe('Business');
      expect(accountingEntityRepo.update).not.toHaveBeenCalled();
    });

    it.each([{ name: 'Updated' }, { type: 'private_company' as const }])(
      'updates non-currency fields without querying journals: %j',
      async (changes) => {
        const response = await service.update(entity, changes, repoOptions);
        const [updated, events, audit] = response.accountingEntity;
        expect(response.updatedBalances).toEqual([]);
        expect(
          ledgerAccountBalanceRepo.findAllByAccountingEntityId
        ).not.toHaveBeenCalled();
        expect(updated).toMatchObject(changes);
        expect(events).toHaveLength(1);
        expect(audit).not.toBeNull();
        expect(
          journalEntryRepo.existsByAccountingEntityId
        ).not.toHaveBeenCalled();
      }
    );

    it.each([{}, { functionalCurrencyCode: 'NGN' as const }])(
      'preserves no-op returns: %j',
      async (changes) => {
        const response = await service.update(entity, changes, repoOptions);
        const [updated, events, audit] = response.accountingEntity;
        expect(response.updatedBalances).toEqual([]);
        expect(
          ledgerAccountBalanceRepo.findAllByAccountingEntityId
        ).not.toHaveBeenCalled();
        expect(updated).toBe(entity);
        expect(events).toEqual([]);
        expect(audit).toBeNull();
        expect(
          journalEntryRepo.existsByAccountingEntityId
        ).not.toHaveBeenCalled();
      }
    );

    it('prepares every functional balance using the caller transaction, without writes', async () => {
      const balancePayload = {
        createdBy: entity.createdBy,
        accountingEntityId: entity.id,
        ledgerAccountId: 'b2222222-2222-4222-8222-222222222222' as TEntityId,
        accountMaterializedPath: '100000',
        currencyCode: 'GBP',
        functionalCurrencyCode: 'NGN',
      };
      const balance = ledgerAccountBalanceEntity.make(balancePayload);
      const secondBalance = ledgerAccountBalanceEntity.make({
        ...balancePayload,
        ledgerAccountId: 'c3333333-3333-4333-8333-333333333333' as TEntityId,
        currencyCode: 'EUR',
      });
      ledgerAccountBalanceRepo.findAllByAccountingEntityId.mockResolvedValue([
        balance,
        secondBalance,
      ]);
      const transactionOptions = { ...repoOptions, tx: {} };
      const response = await service.update(
        entity,
        { functionalCurrencyCode: 'USD' },
        transactionOptions
      );
      expect(
        ledgerAccountBalanceRepo.findAllByAccountingEntityId
      ).toHaveBeenCalledWith(entity.id, transactionOptions);
      expect(journalEntryRepo.existsByAccountingEntityId).toHaveBeenCalledWith(
        entity.id,
        transactionOptions
      );
      expect(
        journalEntryRepo.existsByAccountingEntityId.mock.invocationCallOrder[0]
      ).toBeLessThan(
        ledgerAccountBalanceRepo.findAllByAccountingEntityId.mock
          .invocationCallOrder[0]
      );
      expect(response.updatedBalances).toEqual([
        expect.objectContaining({
          ledgerAccountId: balance.ledgerAccountId,
          amount: balance.amount,
          functionalAmount: expect.objectContaining({
            amount: 0n,
            currency: currencyEntity.getByCode('USD'),
          }),
          version: balance.version + 1,
          createdAt: balance.createdAt,
        }),
        expect.objectContaining({
          ledgerAccountId: secondBalance.ledgerAccountId,
          amount: secondBalance.amount,
          functionalAmount: expect.objectContaining({
            amount: 0n,
            currency: currencyEntity.getByCode('USD'),
          }),
          version: secondBalance.version + 1,
          createdAt: secondBalance.createdAt,
        }),
      ]);
      expect(response.updatedBalances[0].amount).toBe(balance.amount);
      expect(response.updatedBalances[1].amount).toBe(secondBalance.amount);
      expect(balance.functionalAmount.currency.code).toBe('NGN');
      expect(secondBalance.functionalAmount.currency.code).toBe('NGN');
      expect(Object.isFrozen(response)).toBe(true);
      expect(Object.isFrozen(response.updatedBalances[0])).toBe(true);
      expect(accountingEntityRepo.update).not.toHaveBeenCalled();
      expect(ledgerAccountBalanceRepo.update).not.toHaveBeenCalled();
      expect(ledgerAccountBalanceRepo.create).not.toHaveBeenCalled();
      expect(ledgerAccountBalanceRepo.adjustBalance).not.toHaveBeenCalled();
    });

    it.each(['USD', 'EUR'] as const)(
      'rejects a balance denominated in %s instead of the current entity currency (ACC-AE-006)',
      async (functionalCurrencyCode) => {
        const balance = ledgerAccountBalanceEntity.make({
          createdBy: entity.createdBy,
          accountingEntityId: entity.id,
          ledgerAccountId: 'b2222222-2222-4222-8222-222222222222' as TEntityId,
          accountMaterializedPath: '100000',
          currencyCode: 'GBP',
          functionalCurrencyCode,
        });
        ledgerAccountBalanceRepo.findAllByAccountingEntityId.mockResolvedValue([
          balance,
        ]);

        await expect(
          service.update(entity, { functionalCurrencyCode: 'USD' }, repoOptions)
        ).rejects.toThrow(accountingEntityError.FunctionalCurrencyMismatch);

        expect(entity.functionalCurrencyCode).toBe('NGN');
        expect(balance.functionalAmount.currency.code).toBe(
          functionalCurrencyCode
        );
        expect(accountingEntityRepo.update).not.toHaveBeenCalled();
        expect(ledgerAccountBalanceRepo.update).not.toHaveBeenCalled();
      }
    );

    it('propagates balance read failures without persisting', async () => {
      const failure = new Error('balance read failed');
      ledgerAccountBalanceRepo.findAllByAccountingEntityId.mockRejectedValueOnce(
        failure
      );
      await expect(
        service.update(entity, { functionalCurrencyCode: 'USD' }, repoOptions)
      ).rejects.toBe(failure);
      expect(accountingEntityRepo.update).not.toHaveBeenCalled();
      expect(ledgerAccountBalanceRepo.update).not.toHaveBeenCalled();
    });

    it('enforces the balance entity transition before returning prepared updates', async () => {
      const balance = ledgerAccountBalanceEntity.make({
        createdBy: entity.createdBy,
        accountingEntityId: entity.id,
        ledgerAccountId: 'b2222222-2222-4222-8222-222222222222' as TEntityId,
        accountMaterializedPath: '100000',
        currencyCode: 'GBP',
        functionalCurrencyCode: 'NGN',
        functionalAmount: 1n,
      });
      ledgerAccountBalanceRepo.findAllByAccountingEntityId.mockResolvedValue([
        balance,
      ]);
      await expect(
        service.update(entity, { functionalCurrencyCode: 'USD' }, repoOptions)
      ).rejects.toThrow(ledgerAccountBalanceError.CurrencyChangeNonZeroBalance);
      expect(ledgerAccountBalanceRepo.update).not.toHaveBeenCalled();
    });

    it('still enforces entity-owned transition rules', async () => {
      await expect(
        service.update(entity, { type: 'individual' }, repoOptions)
      ).rejects.toThrow(accountingEntityError.TypeChangeNotAllowed);
    });

    it('propagates invariant read failures before applying the transition', async () => {
      const failure = new Error('read failed');
      journalEntryRepo.existsByAccountingEntityId.mockRejectedValueOnce(
        failure
      );
      await expect(
        service.update(entity, { functionalCurrencyCode: 'USD' }, repoOptions)
      ).rejects.toBe(failure);
    });
  });

  describe('grantUserAccess', () => {
    it('should return true if user is owner', () => {
      const entity = {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        ownerId: 'user-1' as TEntityId,
      } as IAccountingEntity;
      expect(service.grantUserAccess(entity, 'user-1' as TEntityId)).toBe(true);
    });

    it('should return false if user is not owner', () => {
      const entity = {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        ownerId: 'user-1' as TEntityId,
      } as IAccountingEntity;
      expect(service.grantUserAccess(entity, 'user-2' as TEntityId)).toBe(
        false
      );
    });
  });

  describe('validateAccess', () => {
    it('should not throw if user is owner', () => {
      const entity = {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        ownerId: 'user-1' as TEntityId,
      } as IAccountingEntity;
      expect(() =>
        service.validateAccess(entity, 'user-1' as TEntityId)
      ).not.toThrow();
    });

    it('should throw UnauthorizedUserAccess if user is not owner', () => {
      const entity = {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        ownerId: 'user-1' as TEntityId,
      } as IAccountingEntity;
      expect(() =>
        service.validateAccess(entity, 'user-2' as TEntityId)
      ).toThrow();
    });
  });
});
