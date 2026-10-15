import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { SYSTEM_JURISDICTIONS } from '@domain/accounting/config/jurisdictions.config';
import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';
import periodError from '@domain/accounting/errors/period.error';
import IAccountingEntityRepo from '@domain/accounting/repos/accounting-entity.repo';
import IAccountingPeriodRepo from '@domain/accounting/repos/accounting-period.repo';
import makeAccountingEntityService from '@domain/accounting/services/accounting-entity.service';
import makeAccountingPeriodService from '@domain/accounting/services/accounting-period.service';
import {
  EAccountingEntityType,
  IAccountingEntity,
} from '@domain/accounting/types/accounting-entity.types';
import { EPeriodUnit } from '@domain/accounting/types/period.types';
import IJournalEntryRepo from '@domain/journal-entry/repos/journal-entry.repo';
import ledgerAccountBalanceEntity from '@domain/ledger/entities/ledger-account-balance.entity';
import ledgerAccountBalanceError from '@domain/ledger/errors/ledger-account-balance.error';
import ILedgerAccountBalanceRepo from '@domain/ledger/repos/ledger-account-balance.repo';
import currencyEntity from '@domain/money/entities/currency.entity';

describe('accountingEntityService', () => {
  const repoOptions: IReadRepoOptions = { correlationId: 'correlation-id' };
  const accountingEntityRepo: jest.Mocked<IAccountingEntityRepo> = {
    update: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndUserId: jest.fn(),
    findByUserId: jest.fn(),
  };
  const accountingPeriodRepo: jest.Mocked<IAccountingPeriodRepo> = {
    findByDate: jest.fn(),
    findAllByDate: jest.fn(),
    findByRange: jest.fn(),
    create: jest.fn(),
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
    findAllByAccountingEntityId: jest.fn(),
    findAllByAccountIds: jest.fn(),
  };
  const service = makeAccountingEntityService({
    ledgerAccountBalanceRepo,
    journalEntryRepo,
    accountingEntityRepo,
    accountingPeriodService: makeAccountingPeriodService({
      accountingPeriodRepo,
    }),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    ledgerAccountBalanceRepo.findAllByAccountingEntityId.mockResolvedValue([]);
    journalEntryRepo.existsByAccountingEntityId.mockResolvedValue(false);
    accountingPeriodRepo.findByRange.mockResolvedValue([]);
    accountingEntityRepo.findByUserId.mockResolvedValue([]);
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

  describe('create', () => {
    const input = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      name: 'Test Business',
      type: EAccountingEntityType.Individual,
      ownerId: '123e4567-e89b-12d3-a456-426614174000' as TEntityId,
      functionalCurrencyCode: 'USD' as const,
      reportingCurrencyCode: 'USD' as const,
      jurisdictionCode: 'US' as const,
      accountingStandardCode: 'US_GAAP' as const,
      fiscalYear: {
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T23:59:59.999Z'),
      },
      accountingPeriod: { unit: EPeriodUnit.Month, count: 1 },
      reportingPeriod: { unit: EPeriodUnit.Quarter, count: 1 },
    };

    it('creates the complete accounting entity graph', async () => {
      const result = await service.create(input, repoOptions);

      expect(result.accountingEntity[0]).toMatchObject({
        ownerId: input.ownerId,
        jurisdictionCode: input.jurisdictionCode,
      });
      expect(result.fiscalYear[0].accountingEntityId).toBe(
        result.accountingEntity[0].id
      );
      expect(result.accountingPeriods.length).toBeGreaterThan(0);
      expect(result.reportingPeriods.length).toBeGreaterThan(0);
      expect(result.accountingContext[0].fiscalYearId).toBe(
        result.fiscalYear[0].id
      );
      expect(result.reportingContext[0].accountingContextId).toBe(
        result.accountingContext[0].id
      );
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('creates a complete private-company graph with the sole-trader standard', async () => {
      const result = await service.create(
        {
          ...input,
          type: EAccountingEntityType.PrivateCompany,
        },
        repoOptions
      );

      expect(result.accountingEntity[0]).toMatchObject({
        type: EAccountingEntityType.PrivateCompany,
        ownerId: input.ownerId,
        jurisdictionCode: input.jurisdictionCode,
      });
      expect(result.fiscalYear[0].accountingEntityId).toBe(
        result.accountingEntity[0].id
      );
      expect(result.accountingPeriods.length).toBeGreaterThan(0);
      expect(result.reportingPeriods.length).toBeGreaterThan(0);
      expect(result.accountingContext[0].fiscalYearId).toBe(
        result.fiscalYear[0].id
      );
      expect(result.reportingContext[0].accountingContextId).toBe(
        result.accountingContext[0].id
      );
      expect(accountingEntityRepo.findByUserId).not.toHaveBeenCalled();
    });

    it('falls back to the first period when current date is outside the fiscal year', async () => {
      const result = await service.create(
        {
          ...input,
          fiscalYear: {
            startDate: new Date('2030-01-01T00:00:00.000Z'),
            endDate: new Date('2030-12-31T23:59:59.999Z'),
          },
        },
        repoOptions
      );

      expect(result.accountingContext[0].currentAccountingPeriodId).toBe(
        result.accountingPeriods[0][0].id
      );
      expect(result.reportingContext[0].currentReportingPeriodId).toBe(
        result.reportingPeriods[0][0].id
      );
    });

    it('accepts the exact jurisdiction fiscal limit', async () => {
      await expect(
        service.create(
          {
            ...input,
            fiscalYear: {
              ...input.fiscalYear,
              endDate: new Date('2027-07-01T00:00:00.000Z'),
            },
          },
          repoOptions
        )
      ).resolves.toBeDefined();
    });

    it('rejects an existing individual accounting entity', async () => {
      accountingEntityRepo.findByUserId.mockResolvedValue([
        {
          createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        } as IAccountingEntity,
      ]);

      await expect(service.create(input, repoOptions)).rejects.toThrow(
        accountingEntityError.OnlyOneIndividualAccountingEntityAllowed
      );
      expect(accountingEntityRepo.findByUserId).toHaveBeenCalledWith(
        input.ownerId,
        repoOptions,
        EAccountingEntityType.Individual
      );
    });

    it('rejects a fiscal year beyond the jurisdiction limit', async () => {
      const endDate = new Date('2027-07-01T00:00:00.001Z');

      await expect(
        service.create(
          {
            ...input,
            fiscalYear: {
              ...input.fiscalYear,
              endDate,
            },
          },
          repoOptions
        )
      ).rejects.toThrow(
        new periodError.FiscalYearExceedsJurisdictionLimit({
          jurisdictionCode: 'US',
          maxFiscalMonths: 18,
          startDate: input.fiscalYear.startDate,
          endDate,
          maximumEndDate: new Date('2027-07-01T00:00:00.000Z'),
        })
      );
    });

    it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
      'rejects invalid jurisdiction fiscal policy %s',
      async (maxFiscalMonths) => {
        const jurisdiction = SYSTEM_JURISDICTIONS.US;
        const configuredLimit = jurisdiction.maxFiscalMonths;
        jurisdiction.maxFiscalMonths = maxFiscalMonths;

        try {
          await expect(service.create(input, repoOptions)).rejects.toThrow(
            'accounting_error_period_date_range_invalid'
          );
        } finally {
          jurisdiction.maxFiscalMonths = configuredLimit;
        }
      }
    );
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
