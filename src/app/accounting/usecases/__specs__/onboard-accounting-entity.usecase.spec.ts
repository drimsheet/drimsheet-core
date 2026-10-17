import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService from '@shared/contracts/__mocks__/repo.mock';
import { ITransactionContext } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { SYSTEM_JURISDICTIONS } from '@domain/accounting/config/jurisdictions.config';
import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';
import periodError from '@domain/accounting/errors/period.error';
import makeAccountingEntityService from '@domain/accounting/services/accounting-entity.service';
import makeAccountingPeriodService from '@domain/accounting/services/accounting-period.service';
import { EAccountingEntityType } from '@domain/accounting/types/accounting-entity.types';
import actorEntity from '@domain/user/entities/actor.entity';
import { IUser } from '@domain/user/types/user.types';

import {
  mockAccountingEntityService,
  mockAccountingPeriodService,
} from '@app/accounting/contracts/__mocks__/accounting.domain.services.mock';
import {
  mockAccountingContextRepo,
  mockAccountingEntityRepo,
  mockAccountingPeriodRepo,
  mockFiscalYearRepo,
  mockReportingContextRepo,
  mockReportingPeriodRepo,
} from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import { IAccountingEntityOnboardingDto } from '@app/accounting/dtos/accounting/accounting.dto';
import makeOnboardAccountingEntityUsecase from '@app/accounting/usecases/onboard-accounting-entity.usecase';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { mockJournalEntryRepo } from '@app/journal-entry/contracts/__mocks__/journal-entry.repos.mock';
import { mockLedgerAccountBalanceRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import mockUserPreferencesAppService from '@app/user/contracts/__mocks__/user-preferences.service.mock';

const actor = actorEntity.makeUser({
  email: 'actor@example.com',
  displayName: 'Actor',
})[0];
const userId = '123e4567-e89b-12d3-a456-426614174000' as TEntityId;
const correlationId = 'legacy-onboarding';
const tx = {} as ITransactionContext;
const payload: IAccountingEntityOnboardingDto = {
  name: 'Test Business',
  entityType: 'individual',
  jurisdictionCode: 'US',
  accountingStandardCode: 'US_GAAP',
  functionalCurrencyCode: 'USD',
  reportingCurrencyCode: 'USD',
  fiscalYear: {
    startDate: new Date('2026-01-01T00:00:00Z'),
    endDate: new Date('2026-12-31T23:59:59.999Z'),
  },
  accountingPeriod: { unit: 'month', count: 12 },
  reportingPeriod: { unit: 'quarter', count: 4 },
  appPreferences: { theme: 'dark', appUsageMode: 'non_power_user' },
};
const entityService = makeAccountingEntityService({
  accountingEntityRepo: mockAccountingEntityRepo,
  journalEntryRepo: mockJournalEntryRepo,
  ledgerAccountBalanceRepo: mockLedgerAccountBalanceRepo,
});
const periodService = makeAccountingPeriodService({
  accountingPeriodRepo: mockAccountingPeriodRepo,
});
const execute = makeOnboardAccountingEntityUsecase({
  appContext: mockAppContext,
  repoService: mockRepoService,
  eventBus: mockEventBus,
  accountingEntityRepo: mockAccountingEntityRepo,
  fiscalYearRepo: mockFiscalYearRepo,
  accountingPeriodRepo: mockAccountingPeriodRepo,
  reportingPeriodRepo: mockReportingPeriodRepo,
  accountingContextRepo: mockAccountingContextRepo,
  reportingContextRepo: mockReportingContextRepo,
  userPreferencesAppService: mockUserPreferencesAppService,
  accountingEntityService: mockAccountingEntityService,
  accountingPeriodService: mockAccountingPeriodService,
});

describe('makeOnboardAccountingEntityUsecase (deprecated)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers({ doNotFake: ['nextTick'] });
    jest.setSystemTime(new Date('2026-06-15T12:00:00Z'));
    mockAccountingEntityRepo.findByUserId.mockResolvedValue([]);
    mockAccountingPeriodRepo.findByRange.mockResolvedValue([]);
    mockAccountingEntityService.create.mockImplementation(entityService.create);
    mockAccountingPeriodService.generate.mockImplementation(
      periodService.generate
    );
    mockAppContext.get.mockReturnValue({
      actor,
      user: { id: userId } as IUser,
      correlationId,
    } as ReturnType<typeof mockAppContext.get>);
    mockRepoService.runInTransaction.mockImplementation(async (write) =>
      write(tx)
    );
    mockEventBus.publish.mockResolvedValue();
  });
  afterEach(() => jest.useRealTimers());

  it.each(Object.values(EAccountingEntityType))(
    'coordinates the complete legacy setup for %s',
    async (entityType) => {
      const result = await execute({ ...payload, entityType });
      const entity = mockAccountingEntityRepo.create.mock.calls[0][0];
      const fiscalYear = mockFiscalYearRepo.create.mock.calls[0][0];
      const periods = mockAccountingPeriodRepo.create.mock.calls[0][0];
      const reportingPeriods = mockReportingPeriodRepo.create.mock.calls[0][0];
      const context = mockAccountingContextRepo.create.mock.calls[0][0];
      const reportingContext = mockReportingContextRepo.create.mock.calls[0][0];
      if (!Array.isArray(periods)) {
        throw new Error('Expected accounting period batch');
      }
      if (!Array.isArray(reportingPeriods)) {
        throw new Error('Expected reporting period batch');
      }

      expect(result).toEqual(entity);
      expect(result).not.toBe(entity);
      expect(entity).toMatchObject({
        ownerId: userId,
        createdBy: actor.id,
        type: entityType,
      });
      expect(fiscalYear.accountingEntityId).toBe(entity.id);
      expect(periods).toHaveLength(12);
      expect(reportingPeriods).toHaveLength(4);
      expect(context).toMatchObject({
        accountingEntityId: entity.id,
        fiscalYearId: fiscalYear.id,
        currentAccountingPeriodId: periods[5].id,
      });
      expect(reportingContext).toMatchObject({
        accountingEntityId: entity.id,
        accountingContextId: context.id,
        currentReportingPeriodId: reportingPeriods[1].id,
      });
      for (const repo of [
        mockAccountingEntityRepo,
        mockFiscalYearRepo,
        mockAccountingPeriodRepo,
        mockReportingPeriodRepo,
        mockAccountingContextRepo,
        mockReportingContextRepo,
      ]) {
        expect(repo.create).toHaveBeenCalledTimes(1);
        expect(repo.create.mock.calls[0][1]).toMatchObject({
          correlationId,
          tx,
          history: expect.anything(),
        });
      }
      expect(mockRepoService.runInTransaction).toHaveBeenCalledTimes(1);
      expect(mockUserPreferencesAppService.update).toHaveBeenCalledWith(
        {
          createdBy: actor.id,
          userId,
          lastActiveAccountingEntityId: entity.id,
          appPreferences: { appUsageMode: 'non_power_user' },
        },
        { correlationId, tx }
      );
      expect(mockAppContext.set).toHaveBeenCalledWith({
        accountingEntity: entity,
      });
      const published = mockEventBus.publish.mock.calls[0][0];
      expect(Array.isArray(published)).toBe(true);
      if (!Array.isArray(published)) {
        throw new Error('Expected event batch');
      }
      expect(published).toHaveLength(20);
      expect(
        published.every((event) => event.correlationId === correlationId)
      ).toBe(true);
      expect(
        mockAccountingEntityRepo.create.mock.invocationCallOrder[0]
      ).toBeLessThan(mockEventBus.publish.mock.invocationCallOrder[0]);
    }
  );

  it('selects the first periods when today is outside the fiscal year', async () => {
    await execute({
      ...payload,
      fiscalYear: {
        startDate: new Date('2030-01-01'),
        endDate: new Date('2030-12-31'),
      },
    });
    expect(
      mockAccountingContextRepo.create.mock.calls[0][0]
        .currentAccountingPeriodId
    ).toBe([mockAccountingPeriodRepo.create.mock.calls[0][0]].flat()[0].id);
    expect(
      mockReportingContextRepo.create.mock.calls[0][0].currentReportingPeriodId
    ).toBe([mockReportingPeriodRepo.create.mock.calls[0][0]].flat()[0].id);
  });

  it('validates input before accessing dependencies', async () => {
    await expect(
      execute({ ...payload, name: 1 as unknown as string })
    ).rejects.toThrow();
    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockAccountingEntityService.create).not.toHaveBeenCalled();
  });

  it('retains the Individual ownership restriction', async () => {
    const [existing] = accountingEntityEntity.make({
      createdBy: actor.id,
      ownerId: userId,
      name: payload.name,
      type: 'individual',
      jurisdictionCode: 'US',
      functionalCurrencyCode: 'USD',
    });
    mockAccountingEntityRepo.findByUserId.mockResolvedValue([existing]);
    await expect(execute(payload)).rejects.toBeInstanceOf(
      accountingEntityError.OnlyOneIndividualAccountingEntityAllowed
    );
    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
  });

  it('accepts the exact jurisdiction fiscal-year limit', async () => {
    await expect(
      execute({
        ...payload,
        fiscalYear: {
          ...payload.fiscalYear,
          endDate: new Date('2027-07-01T00:00:00Z'),
        },
      })
    ).resolves.toBeDefined();
  });

  it('rejects fiscal years beyond the jurisdiction limit before persistence', async () => {
    await expect(
      execute({
        ...payload,
        fiscalYear: {
          ...payload.fiscalYear,
          endDate: new Date('2027-07-01T00:00:00.001Z'),
        },
      })
    ).rejects.toBeInstanceOf(periodError.FiscalYearExceedsJurisdictionLimit);
    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, NaN, Infinity])(
    'retains fiscal policy validation for %s',
    async (maxFiscalMonths) => {
      const jurisdiction = SYSTEM_JURISDICTIONS.US;
      const original = jurisdiction.maxFiscalMonths;
      jurisdiction.maxFiscalMonths = maxFiscalMonths;
      try {
        await expect(execute(payload)).rejects.toBeInstanceOf(
          periodError.InvalidDateRange
        );
        expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
      } finally {
        jurisdiction.maxFiscalMonths = original;
      }
    }
  );

  it('does not publish or update request context after persistence failure', async () => {
    const failure = new Error('history persistence failed');
    mockAccountingEntityRepo.create.mockRejectedValueOnce(failure);
    await expect(execute(payload)).rejects.toBe(failure);
    expect(mockAppContext.set).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('retains preference-failure rollback behaviour', async () => {
    const failure = new Error('preference persistence failed');
    mockUserPreferencesAppService.update.mockRejectedValueOnce(failure);
    await expect(execute(payload)).rejects.toBe(failure);
    expect(mockAppContext.set).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('publishes nothing when the outer commit fails', async () => {
    const failure = new Error('commit failed');
    mockRepoService.runInTransaction.mockImplementationOnce(async (write) => {
      await write(tx);
      expect(mockEventBus.publish).not.toHaveBeenCalled();
      throw failure;
    });
    await expect(execute(payload)).rejects.toBe(failure);
    expect(mockAppContext.set).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('waits for commit before updating context and publishing', async () => {
    let finishCommit!: () => void;
    mockRepoService.runInTransaction.mockImplementationOnce(async (write) => {
      await write(tx);
      await new Promise<void>((resolve) => {
        finishCommit = resolve;
      });
    });
    const result = execute(payload);
    await new Promise(process.nextTick);
    expect(mockAppContext.set).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    finishCommit();
    await expect(result).resolves.toBeDefined();
    expect(mockAppContext.set).toHaveBeenCalled();
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
  });
});
