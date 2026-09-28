import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService from '@shared/contracts/__mocks__/repo.mock';
import { ITransactionContext } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';
import makeAccountingEntityService from '@domain/accounting/services/accounting-entity.service';
import { IAccountingEntityCreationResult } from '@domain/accounting/types/accounting-entity.service.types';
import {
  EAccountingEntityType,
  IAccountingEntity,
} from '@domain/accounting/types/accounting-entity.types';
import { EPeriodUnit } from '@domain/accounting/types/period.types';
import actorEntity from '@domain/user/entities/actor.entity';
import { IUser } from '@domain/user/types/user.types';

import { mockAccountingEntityService } from '@app/accounting/contracts/__mocks__/accounting.domain.services.mock';
import {
  mockAccountingContextRepo,
  mockAccountingEntityRepo,
  mockAccountingPeriodRepo,
  mockFiscalYearRepo,
  mockReportingContextRepo,
  mockReportingPeriodRepo,
} from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import { IAccountingEntityCreationDto } from '@app/accounting/dtos/accounting/accounting.dto';
import createAccountingEntityUseCase from '@app/accounting/usecases/create-accounting-entity.usecase';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import mockUserPreferencesService from '@app/user/contracts/__mocks__/user-preferences.service.mock';
import { EAppUsageModePreference } from '@app/user/types/user-preferences.types';

const mockAccountingDomainServices = Object.freeze({
  accountingEntity: mockAccountingEntityService,
});

const actor = {
  ...actorEntity.makeUser({
    email: 'actor@example.com',
    displayName: 'Actor',
  })[0],
  id: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
};

describe('createAccountingEntityUseCase', () => {
  const correlationId = 'test-corr-id';
  const userId = '123e4567-e89b-12d3-a456-426614174000' as TEntityId;
  const validPayload: IAccountingEntityCreationDto = {
    name: 'Test Business',
    entityType: EAccountingEntityType.Individual,
    accountingStandardCode: 'US_GAAP',
    functionalCurrencyCode: 'USD',
    reportingCurrencyCode: 'USD',
    jurisdictionCode: 'US',
    appPreferences: {
      theme: 'dark',
      appUsageMode: EAppUsageModePreference.NonPowerUser,
    },
    fiscalYear: {
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-12-31T23:59:59.999Z'),
    },
    accountingPeriod: { unit: EPeriodUnit.Month, count: 1 },
    reportingPeriod: { unit: EPeriodUnit.Quarter, count: 1 },
  };
  let accounting: IAccountingEntityCreationResult;
  let accountingEntity: IAccountingEntity;
  const getUseCase = () =>
    createAccountingEntityUseCase({
      appContext: mockAppContext,
      repoService: mockRepoService,
      accountingEntityRepo: mockAccountingEntityRepo,
      userPreferencesService: mockUserPreferencesService,
      fiscalYearRepo: mockFiscalYearRepo,
      accountingPeriodRepo: mockAccountingPeriodRepo,
      accountingContextRepo: mockAccountingContextRepo,
      reportingPeriodRepo: mockReportingPeriodRepo,
      reportingContextRepo: mockReportingContextRepo,
      accountingEntityService: mockAccountingDomainServices.accountingEntity,
      eventBus: mockEventBus,
    });

  beforeEach(async () => {
    mockAccountingEntityRepo.findByUserId.mockResolvedValue([]);
    accounting = await makeAccountingEntityService({
      accountingEntityRepo: mockAccountingEntityRepo,
    }).create(
      {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        name: validPayload.name,
        type: validPayload.entityType,
        ownerId: userId,
        functionalCurrencyCode: validPayload.functionalCurrencyCode,
        reportingCurrencyCode: validPayload.reportingCurrencyCode,
        jurisdictionCode: validPayload.jurisdictionCode,
        accountingStandardCode: validPayload.accountingStandardCode,
        fiscalYear: validPayload.fiscalYear,
        accountingPeriod: validPayload.accountingPeriod,
        reportingPeriod: validPayload.reportingPeriod,
      },
      { correlationId }
    );
    accountingEntity = accounting.accountingEntity[0];

    jest.clearAllMocks();
    mockRepoService.runInTransaction
      .mockReset()
      .mockImplementation(async (transactionFn) =>
        transactionFn('mock-tx' as unknown as ITransactionContext)
      );
    mockAppContext.get.mockReturnValue({
      actor,
      correlationId,
      user: {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        actorId: 'b2222222-2222-4222-8222-222222222222' as TEntityId,
        id: userId,
      } as IUser,
    } as ReturnType<typeof mockAppContext.get>);
    mockAccountingDomainServices.accountingEntity.create.mockResolvedValue(
      accounting
    );
    mockUserPreferencesService.update.mockResolvedValue({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      userId,
      lastActiveAccountingEntityId: accountingEntity.id,
      appPreferences: validPayload.appPreferences,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockEventBus.publish.mockResolvedValue();
  });

  it('validates the request before accessing dependencies', async () => {
    await expect(
      getUseCase()({ ...validPayload, name: 1 as unknown as string })
    ).rejects.toThrow();
    expect(mockAppContext.get).not.toHaveBeenCalled();
  });

  it('creates a private company through the existing workflow', async () => {
    const privateCompanyPayload = {
      ...validPayload,
      entityType: EAccountingEntityType.PrivateCompany,
    };
    const privateCompanyAccounting = await makeAccountingEntityService({
      accountingEntityRepo: mockAccountingEntityRepo,
    }).create(
      {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        name: privateCompanyPayload.name,
        type: privateCompanyPayload.entityType,
        ownerId: userId,
        functionalCurrencyCode: privateCompanyPayload.functionalCurrencyCode,
        reportingCurrencyCode: privateCompanyPayload.reportingCurrencyCode,
        jurisdictionCode: privateCompanyPayload.jurisdictionCode,
        accountingStandardCode: privateCompanyPayload.accountingStandardCode,
        fiscalYear: privateCompanyPayload.fiscalYear,
        accountingPeriod: privateCompanyPayload.accountingPeriod,
        reportingPeriod: privateCompanyPayload.reportingPeriod,
      },
      { correlationId }
    );
    const privateCompanyEntity = privateCompanyAccounting.accountingEntity[0];

    mockAccountingDomainServices.accountingEntity.create.mockResolvedValueOnce(
      privateCompanyAccounting
    );

    await expect(getUseCase()(privateCompanyPayload)).resolves.toBe(
      privateCompanyEntity
    );

    expect(
      mockAccountingDomainServices.accountingEntity.create
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        type: EAccountingEntityType.PrivateCompany,
        ownerId: userId,
      }),
      { correlationId }
    );
    expect(mockRepoService.runInTransaction).toHaveBeenCalledTimes(1);
    expect(mockAppContext.set).toHaveBeenCalledWith({
      accountingEntity: privateCompanyEntity,
    });
  });

  it('propagates the existing individual accounting entity error', async () => {
    mockAccountingDomainServices.accountingEntity.create.mockRejectedValueOnce(
      new accountingEntityError.OnlyOneIndividualAccountingEntityAllowed({
        ownerId: userId,
      })
    );

    await expect(getUseCase()(validPayload)).rejects.toThrow(
      'accounting_error_accounting_entity_only_one_individual_accounting_entity_allowed_conflict'
    );
    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
  });

  it('orchestrates accounting creation and transactional persistence', async () => {
    await expect(getUseCase()(validPayload)).resolves.toBe(accountingEntity);

    expect(
      mockAccountingDomainServices.accountingEntity.create
    ).toHaveBeenCalledWith(expect.objectContaining({ ownerId: userId }), {
      correlationId,
    });
    expect(mockRepoService.runInTransaction).toHaveBeenCalledTimes(1);
    expect(mockAccountingEntityRepo.create).toHaveBeenCalled();
    expect(mockUserPreferencesService.update).toHaveBeenCalledWith(
      {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        userId,
        lastActiveAccountingEntityId: accountingEntity.id,
        appPreferences: {
          appUsageMode: EAppUsageModePreference.NonPowerUser,
        },
      },
      { correlationId, tx: 'mock-tx' }
    );
    expect(mockFiscalYearRepo.create).toHaveBeenCalled();
    expect(mockAccountingPeriodRepo.create).toHaveBeenCalled();
    expect(mockAccountingContextRepo.create).toHaveBeenCalled();
    expect(mockReportingPeriodRepo.create).toHaveBeenCalled();
    expect(mockReportingContextRepo.create).toHaveBeenCalled();
    expect(mockAppContext.set).toHaveBeenCalledWith({ accountingEntity });

    expect(
      mockAccountingEntityRepo.create.mock.invocationCallOrder[0]
    ).toBeLessThan(
      mockUserPreferencesService.update.mock.invocationCallOrder[0]
    );
    expect(
      mockUserPreferencesService.update.mock.invocationCallOrder[0]
    ).toBeLessThan(mockFiscalYearRepo.create.mock.invocationCallOrder[0]);
  });

  it('does not update context or publish when persistence fails', async () => {
    mockAccountingEntityRepo.create.mockRejectedValueOnce(
      new Error('persistence failed')
    );

    await expect(getUseCase()(validPayload)).rejects.toThrow(
      'persistence failed'
    );
    expect(mockAppContext.set).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('does not update context or publish when preference persistence fails', async () => {
    mockUserPreferencesService.update.mockRejectedValueOnce(
      new Error('preference persistence failed')
    );

    await expect(getUseCase()(validPayload)).rejects.toThrow(
      'preference persistence failed'
    );
    expect(mockAppContext.set).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('publishes only accounting events without bootstrapping ledger accounts', async () => {
    await getUseCase()(validPayload);

    const expectedEvents = [
      ...accounting.accountingEntity[1],
      ...accounting.fiscalYear[1],
      ...accounting.accountingPeriods.flatMap(([, events]) => events),
      ...accounting.accountingContext[1],
      ...accounting.reportingPeriods.flatMap(([, events]) => events),
      ...accounting.reportingContext[1],
    ];
    const published = mockEventBus.publish.mock.calls[0][0];
    if (!Array.isArray(published))
      throw new Error('Expected a batch of events');
    expect(published).toHaveLength(expectedEvents.length);
    expect(published.map((event) => event.type)).toEqual(
      expectedEvents.map((event) => event.type)
    );
    expect(
      published.every((event) => event.correlationId === correlationId)
    ).toBe(true);
  });

  it('awaits publication after the transaction and context update', async () => {
    let resolvePublication: (() => void) | undefined;
    mockEventBus.publish.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolvePublication = resolve;
      })
    );

    const result = getUseCase()(validPayload);
    await new Promise(process.nextTick);
    expect(mockAppContext.set).toHaveBeenCalled();

    let settled = false;
    void result.then(() => {
      settled = true;
    });
    await new Promise(process.nextTick);
    expect(settled).toBe(false);

    resolvePublication?.();
    await expect(result).resolves.toBe(accountingEntity);
    expect(
      mockRepoService.runInTransaction.mock.invocationCallOrder[0]
    ).toBeLessThan(mockAppContext.set.mock.invocationCallOrder[0]);
    expect(mockAppContext.set.mock.invocationCallOrder[0]).toBeLessThan(
      mockEventBus.publish.mock.invocationCallOrder[0]
    );
  });
});
