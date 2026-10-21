import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';
import periodError from '@domain/accounting/errors/period.error';
import makeAccountingPeriodService from '@domain/accounting/services/accounting-period.service';
import actorEntity from '@domain/user/entities/actor.entity';
import { IUser } from '@domain/user/types/user.types';

import mockAccountingContextQueryRepo from '@app/accounting/contracts/__mocks__/accounting-context.query.repo.mock';
import { mockAccountingEntityService } from '@app/accounting/contracts/__mocks__/accounting.domain.services.mock';
import {
  mockAccountingContextRepo,
  mockAccountingEntityRepo,
  mockAccountingPeriodRepo,
  mockFiscalYearRepo,
  mockReportingContextRepo,
  mockReportingPeriodRepo,
} from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import mockReportingContextQueryRepo from '@app/accounting/contracts/__mocks__/reporting-context.query.repo.mock';
import { IAccountingEntityCreationDto } from '@app/accounting/dtos/accounting/accounting.dto';
import makeCreateAccountingEntityUsecase from '@app/accounting/usecases/create-accounting-entity.usecase';
import makeGetAccountingContextsUsecase from '@app/accounting/usecases/get-accounting-contexts.usecase';
import makeGetReportingContextsUsecase from '@app/accounting/usecases/get-reporting-contexts.usecase';
import makeGetUserAccountingEntitiesUseCase from '@app/accounting/usecases/get-user-accounting-entities.usecase';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import mockUserPreferencesAppService from '@app/user/contracts/__mocks__/user-preferences.service.mock';
import { mockUserPreferencesRepo } from '@app/user/contracts/__mocks__/user.repos.mock';

const actor = actorEntity.makeUser({
  email: 'actor@example.com',
  displayName: 'Actor',
})[0];
const userId = '123e4567-e89b-12d3-a456-426614174000' as TEntityId;
const correlationId = 'entity-only-creation';
const payload: IAccountingEntityCreationDto = {
  name: 'Standalone business',
  entityType: 'sole_trader',
  functionalCurrencyCode: 'NGN',
  jurisdictionCode: 'NG',
};
const creation = accountingEntityEntity.make({
  name: payload.name,
  type: payload.entityType,
  functionalCurrencyCode: payload.functionalCurrencyCode,
  jurisdictionCode: payload.jurisdictionCode,
  ownerId: userId,
  createdBy: actor.id,
});
const [entity, events] = creation;

const execute = makeCreateAccountingEntityUsecase({
  appContext: mockAppContext,
  accountingEntityRepo: mockAccountingEntityRepo,
  accountingEntityService: mockAccountingEntityService,
  eventBus: mockEventBus,
});

describe('makeCreateAccountingEntityUsecase', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      actor,
      user: { id: userId } as IUser,
      correlationId,
    } as ReturnType<typeof mockAppContext.get>);
    mockAccountingEntityService.create.mockResolvedValue(creation);
    mockEventBus.publish.mockResolvedValue();
  });

  it('creates only the entity with authenticated ownership and returns it directly', async () => {
    const result = await execute(payload);
    expect(result).toBe(entity);
    expect(mockAppContext.get).toHaveBeenCalledWith(['user', 'actor']);
    expect(mockAccountingEntityService.create).toHaveBeenCalledWith(
      {
        name: payload.name,
        type: payload.entityType,
        functionalCurrencyCode: payload.functionalCurrencyCode,
        jurisdictionCode: payload.jurisdictionCode,
        ownerId: userId,
        createdBy: actor.id,
      },
      { correlationId }
    );
    expect(mockAccountingEntityRepo.create).toHaveBeenCalledTimes(1);
    expect(mockAccountingEntityRepo.create).toHaveBeenCalledWith(entity, {
      correlationId,
      history: expect.objectContaining({ actorId: actor.id, correlationId }),
    });
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      events.map((event) =>
        expect.objectContaining({
          type: event.type,
          data: entity,
          correlationId,
        })
      )
    );
    for (const repo of [
      mockFiscalYearRepo,
      mockAccountingPeriodRepo,
      mockReportingPeriodRepo,
      mockAccountingContextRepo,
      mockReportingContextRepo,
    ]) {
      expect(repo.create).not.toHaveBeenCalled();
    }
    expect(mockUserPreferencesAppService.update).not.toHaveBeenCalled();
    expect(mockUserPreferencesRepo.update).not.toHaveBeenCalled();
    expect(mockAppContext.set).not.toHaveBeenCalled();
  });

  it('supports calendarless entity and context reads while rejecting posting', async () => {
    await execute(payload);
    mockAppContext.get.mockReturnValue({
      actor,
      user: { id: userId } as IUser,
      accountingEntity: entity,
      correlationId,
    } as ReturnType<typeof mockAppContext.get>);
    mockAccountingEntityRepo.findByUserId.mockResolvedValue([entity]);
    mockAccountingContextQueryRepo.findActiveByAccountingEntityId.mockResolvedValue(
      []
    );
    mockReportingContextQueryRepo.findActiveByAccountingEntityId.mockResolvedValue(
      []
    );
    mockAccountingPeriodRepo.findAllByDate.mockResolvedValue([]);

    const readEntities = makeGetUserAccountingEntitiesUseCase({
      appContext: mockAppContext,
      accountingEntityRepo: mockAccountingEntityRepo,
    });
    const readAccountingContexts = makeGetAccountingContextsUsecase({
      appContext: mockAppContext,
      accountingContextQueryRepo: mockAccountingContextQueryRepo,
    });
    const readReportingContexts = makeGetReportingContextsUsecase({
      appContext: mockAppContext,
      reportingContextQueryRepo: mockReportingContextQueryRepo,
    });
    const postingPeriods = makeAccountingPeriodService({
      accountingPeriodRepo: mockAccountingPeriodRepo,
    });

    await expect(readEntities()).resolves.toEqual([entity]);
    await expect(readAccountingContexts()).resolves.toEqual([]);
    await expect(readReportingContexts()).resolves.toEqual([]);
    await expect(
      postingPeriods.validatePostingPeriod(entity.id, new Date('2026-10-17'), {
        correlationId,
      })
    ).rejects.toBeInstanceOf(periodError.PostingDateNotCovered);
  });

  it.each([
    { name: 123 },
    { entityType: 'unsupported' },
    { jurisdictionCode: 'ZZ' },
    { functionalCurrencyCode: 'ZZ' },
    { ownerId: userId },
    { createdBy: actor.id },
    { fiscalYear: {} },
    { accountingPeriod: {} },
    { reportingPeriod: {} },
    { accountingStandardCode: 'US_GAAP' },
    { reportingCurrencyCode: 'USD' },
    { appPreferences: { appUsageMode: 'non_power_user' } },
  ])(
    'rejects invalid or obsolete fields before orchestration: %j',
    async (override) => {
      await expect(
        execute({ ...payload, ...override } as IAccountingEntityCreationDto)
      ).rejects.toBeInstanceOf(appError.UnprocessableEntity);
      expect(mockAppContext.get).not.toHaveBeenCalled();
      expect(mockAccountingEntityService.create).not.toHaveBeenCalled();
      expect(mockAccountingEntityRepo.create).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    }
  );

  it('does not create when authenticated context is missing', async () => {
    mockAppContext.get.mockImplementation(() => {
      throw new appError.Unauthorized();
    });
    await expect(execute(payload)).rejects.toBeInstanceOf(
      appError.Unauthorized
    );
    expect(mockAccountingEntityService.create).not.toHaveBeenCalled();
    expect(mockAccountingEntityRepo.create).not.toHaveBeenCalled();
  });

  it('propagates the Individual ownership invariant without persistence', async () => {
    mockAccountingEntityService.create.mockRejectedValueOnce(
      new accountingEntityError.OnlyOneIndividualAccountingEntityAllowed()
    );
    await expect(
      execute({ ...payload, entityType: 'individual' })
    ).rejects.toBeInstanceOf(
      accountingEntityError.OnlyOneIndividualAccountingEntityAllowed
    );
    expect(mockAccountingEntityRepo.create).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it.each([new Error('history insert failed'), new Error('commit failed')])(
    'propagates persistence failure without publishing',
    async (failure) => {
      mockAccountingEntityRepo.create.mockRejectedValueOnce(failure);
      await expect(execute(payload)).rejects.toBe(failure);
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    }
  );

  it('waits for persistence to complete before publishing', async () => {
    let finishPersistence!: () => void;
    mockAccountingEntityRepo.create.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishPersistence = resolve;
        })
    );
    const pending = execute(payload);
    await new Promise(process.nextTick);
    expect(mockAccountingEntityRepo.create).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    finishPersistence();
    await expect(pending).resolves.toBe(entity);
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
  });

  it('awaits event publication and propagates publication failure after persistence', async () => {
    const failure = new Error('publish failed');
    mockEventBus.publish.mockRejectedValueOnce(failure);
    await expect(execute(payload)).rejects.toBe(failure);
    expect(mockAccountingEntityRepo.create).toHaveBeenCalledTimes(1);
  });
});
