import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { SYSTEM_JURISDICTIONS } from '@domain/accounting/config/jurisdictions.config';
import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';
import periodError from '@domain/accounting/errors/period.error';
import IAccountingEntityRepo from '@domain/accounting/repos/accounting-entity.repo';
import makeAccountingEntityService from '@domain/accounting/services/accounting-entity.service';
import {
  EAccountingEntityType,
  IAccountingEntity,
} from '@domain/accounting/types/accounting-entity.types';
import { EPeriodUnit } from '@domain/accounting/types/period.types';

describe('accountingEntityService', () => {
  const repoOptions: IReadRepoOptions = { correlationId: 'correlation-id' };
  const accountingEntityRepo: jest.Mocked<IAccountingEntityRepo> = {
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndUserId: jest.fn(),
    findByUserId: jest.fn(),
  };
  const service = makeAccountingEntityService({ accountingEntityRepo });

  beforeEach(() => {
    jest.clearAllMocks();
    accountingEntityRepo.findByUserId.mockResolvedValue([]);
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
