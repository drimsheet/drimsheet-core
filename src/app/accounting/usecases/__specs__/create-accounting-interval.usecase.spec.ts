import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService, {
  mockRepoTransaction,
} from '@shared/contracts/__mocks__/repo.mock';
import generateUUID from '@shared/utils/uuid-generator';
import appError from '@shared/values/errors/app.error';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import accountingIntervalEntity from '@domain/accounting/entities/accounting-interval.entity';
import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';
import accountingError from '@domain/accounting/errors/accounting.error';
import periodError from '@domain/accounting/errors/period.error';
import actorEntity from '@domain/user/entities/actor.entity';

import { mockAccountingIntervalService } from '@app/accounting/contracts/__mocks__/accounting.domain.services.mock';
import {
  mockAccountingContextRepo,
  mockAccountingEntityRepo,
  mockAccountingIntervalRepo,
  mockAccountingPeriodRepo,
  mockFiscalYearRepo,
  mockReportingContextRepo,
  mockReportingPeriodRepo,
} from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import { IAccountingIntervalCreationReq } from '@app/accounting/dtos/accounting-interval/accounting-interval.dto';
import accountingAppError from '@app/accounting/errors/accounting.error';
import makeCreateAccountingIntervalUsecase from '@app/accounting/usecases/create-accounting-interval.usecase';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';

describe('makeCreateAccountingIntervalUsecase', () => {
  const actor = actorEntity.makeUser({
    email: 'owner@example.com',
    displayName: 'Owner',
  })[0];
  const userId = generateUUID();
  const [entity] = accountingEntityEntity.make({
    createdBy: actor.id,
    ownerId: userId,
    name: 'Business',
    type: 'sole_trader',
    functionalCurrencyCode: 'NGN',
    jurisdictionCode: 'NG',
  });
  const [year] = fiscalYearEntity.make({
    accountingEntityId: entity.id,
    createdBy: actor.id,
    startDate: new Date('2092-01-01'),
    endDate: new Date('2092-12-31'),
    status: 'open',
  });
  const payload: IAccountingIntervalCreationReq = {
    fiscalYearId: year.id,
    unit: 'month',
    count: 12,
    periods: Array.from({ length: 12 }, (_, index) => ({
      name: `Month ${index + 1}`,
    })),
  };
  const creation = accountingIntervalEntity.make(
    {
      accountingEntityId: entity.id,
      createdBy: actor.id,
      fiscalYearId: year.id,
      unit: payload.unit,
      count: payload.count,
      periods: payload.periods,
      startDate: year.startDate,
      endDate: new Date('2093-01-01'),
    },
    new Date('2092-04-01')
  );
  const [interval, events] = creation;
  const correlationId = 'create-accounting-interval';
  const tx = mockRepoTransaction.context;
  const execute = makeCreateAccountingIntervalUsecase({
    appContext: mockAppContext,
    fiscalYearRepo: mockFiscalYearRepo,
    accountingIntervalService: mockAccountingIntervalService,
    accountingIntervalRepo: mockAccountingIntervalRepo,
    accountingPeriodRepo: mockAccountingPeriodRepo,
    repoService: mockRepoService,
    eventBus: mockEventBus,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockRepoService.runInTransaction.mockImplementation(async (fn) => fn(tx));
    mockAppContext.get.mockReturnValue({
      actor,
      accountingEntity: entity,
      correlationId,
    } as ReturnType<typeof mockAppContext.get>);
    mockFiscalYearRepo.findById.mockResolvedValue(year);
    mockAccountingIntervalService.create.mockResolvedValue(creation);
  });

  it('persists interval and periods separately with their histories in one transaction', async () => {
    const result = await execute(payload);
    expect(result).toBe(interval);
    expect(mockAppContext.get).toHaveBeenCalledWith([
      'accountingEntity',
      'actor',
    ]);
    expect(mockFiscalYearRepo.findById).toHaveBeenCalledWith(
      entity.id,
      year.id,
      { correlationId }
    );
    expect(mockAccountingIntervalService.create).toHaveBeenCalledWith(
      {
        accountingEntityId: entity.id,
        fiscalYear: year,
        createdBy: actor.id,
        unit: payload.unit,
        count: payload.count,
        periods: payload.periods,
      },
      { correlationId }
    );
    expect(mockAccountingIntervalRepo.create).toHaveBeenCalledTimes(1);
    const [saved, options] = mockAccountingIntervalRepo.create.mock.calls[0];
    const { periods, ...intervalHeader } = interval;
    expect(saved).toEqual(intervalHeader);
    expect(saved).not.toHaveProperty('periods');
    expect(options).toEqual({
      correlationId,
      tx,
      history: expect.objectContaining({
        entityId: interval.id,
        actorId: actor.id,
        correlationId,
        diff: {
          before: null,
          after: JSON.parse(JSON.stringify(interval)) as unknown,
        },
      }),
    });
    expect(mockAccountingPeriodRepo.create).toHaveBeenCalledTimes(1);
    expect(mockAccountingPeriodRepo.create).toHaveBeenCalledWith(periods, {
      correlationId,
      tx,
      history: periods.map((period) =>
        expect.objectContaining({
          entityId: period.id,
          actorId: actor.id,
          correlationId,
          diff: {
            before: null,
            after: JSON.parse(JSON.stringify(period)) as unknown,
          },
        })
      ),
    });
    expect(options.tx).toBe(tx);
    expect(mockAccountingPeriodRepo.create.mock.calls[0][1].tx).toBe(tx);
    expect(mockRepoService.runInTransaction).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      events.map((event) =>
        expect.objectContaining({
          ...event,
          correlationId,
          enrichedAt: expect.any(Date),
        })
      )
    );
    for (const repo of [
      mockAccountingEntityRepo,
      mockFiscalYearRepo,
      mockAccountingContextRepo,
      mockReportingContextRepo,
      mockReportingPeriodRepo,
    ]) {
      expect(repo.create).not.toHaveBeenCalled();
    }
    expect(mockAppContext.set).not.toHaveBeenCalled();
  });

  it('rejects a missing fiscal year before creation', async () => {
    mockFiscalYearRepo.findById.mockResolvedValue(null);
    await expect(execute(payload)).rejects.toBeInstanceOf(
      accountingAppError.FiscalYearNotFound
    );
    expect(mockAccountingIntervalService.create).not.toHaveBeenCalled();
    expect(mockAccountingIntervalRepo.create).not.toHaveBeenCalled();
    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('scopes the fiscal-year lookup to the active entity', async () => {
    const foreignEntityId = generateUUID();
    mockAppContext.get.mockReturnValue({
      actor,
      accountingEntity: { ...entity, id: foreignEntityId },
      correlationId,
    });
    mockFiscalYearRepo.findById.mockImplementation(
      async (accountingEntityId, id) =>
        accountingEntityId === year.accountingEntityId && id === year.id
          ? year
          : null
    );
    await expect(execute(payload)).rejects.toBeInstanceOf(
      accountingAppError.FiscalYearNotFound
    );
    expect(mockFiscalYearRepo.findById).toHaveBeenCalledWith(
      foreignEntityId,
      year.id,
      { correlationId }
    );
    expect(mockAccountingIntervalService.create).not.toHaveBeenCalled();
    expect(mockAccountingIntervalRepo.create).not.toHaveBeenCalled();
    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
  });

  it('propagates fiscal-year read failures', async () => {
    const failure = new Error('read failed');
    mockFiscalYearRepo.findById.mockRejectedValue(failure);
    await expect(execute(payload)).rejects.toBe(failure);
    expect(mockAccountingIntervalService.create).not.toHaveBeenCalled();
    expect(mockAccountingIntervalRepo.create).not.toHaveBeenCalled();
    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
  });

  it.each([
    accountingError.AccountingIntervalAlreadyExists,
    periodError.InvalidInterval,
    periodError.InvalidFiscalYearId,
  ])(
    'propagates domain rejection without persisting or publishing',
    async (ErrorType) => {
      const failure = new ErrorType();
      mockAccountingIntervalService.create.mockRejectedValue(failure);
      await expect(execute(payload)).rejects.toBe(failure);
      expect(mockAccountingIntervalRepo.create).not.toHaveBeenCalled();
      expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    }
  );

  it('passes quarter units and period names to the domain service', async () => {
    const request: IAccountingIntervalCreationReq = {
      ...payload,
      unit: 'quarter',
      count: 4,
      periods: Array.from({ length: 4 }, (_, index) => ({
        name: `Quarter ${index + 1}`,
      })),
    };
    await execute(request);
    expect(mockAccountingIntervalService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        unit: 'quarter',
        count: 4,
        periods: request.periods,
      }),
      { correlationId }
    );
  });

  it.each([
    { accountingEntityId: generateUUID() },
    { createdBy: userId },
    { fiscalYearId: 'invalid' },
    { fiscalYearId: undefined },
    { unit: 'invalid' },
    { count: 0 },
    { count: 1.5 },
    { periods: undefined },
    { periods: null },
    { periods: {} },
    { periods: [{ name: 42 }] },
    { periods: [{}] },
    { periods: [{ name: 'January', startDate: '2092-01-01' }] },
    { startDate: '2092-01-01' },
    { endDate: '2093-01-01' },
  ])('rejects malformed input before reading: %j', async (change) => {
    await expect(
      execute({ ...payload, ...change } as IAccountingIntervalCreationReq)
    ).rejects.toBeInstanceOf(appError.UnprocessableEntity);
    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockFiscalYearRepo.findById).not.toHaveBeenCalled();
    expect(mockAccountingIntervalService.create).not.toHaveBeenCalled();
    expect(mockAccountingIntervalRepo.create).not.toHaveBeenCalled();
    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it.each([
    new Error('history failed'),
    new accountingError.AccountingIntervalAlreadyExists(),
  ])('propagates persistence failure without publishing', async (failure) => {
    mockAccountingIntervalRepo.create.mockRejectedValue(failure);
    await expect(execute(payload)).rejects.toBe(failure);
    expect(mockAccountingPeriodRepo.create).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('awaits domain preparation before persisting', async () => {
    let finish!: () => void;
    mockAccountingIntervalService.create.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve(creation);
        })
    );
    const pending = execute(payload);
    await new Promise(process.nextTick);
    expect(mockAccountingIntervalRepo.create).not.toHaveBeenCalled();
    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    finish();
    await pending;
    expect(mockAccountingIntervalRepo.create).toHaveBeenCalledTimes(1);
  });

  it('awaits the interval write before writing periods or publishing', async () => {
    let finish!: () => void;
    mockAccountingIntervalRepo.create.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    const pending = execute(payload);
    await new Promise(process.nextTick);
    expect(mockAccountingIntervalRepo.create).toHaveBeenCalledTimes(1);
    expect(mockAccountingPeriodRepo.create).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    finish();
    await pending;
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
  });

  it('propagates a period write failure through the transaction without publishing', async () => {
    const failure = new Error('period history failed');
    mockAccountingPeriodRepo.create.mockRejectedValue(failure);
    await expect(execute(payload)).rejects.toBe(failure);
    expect(mockAccountingIntervalRepo.create).toHaveBeenCalledTimes(1);
    expect(mockAccountingPeriodRepo.create).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('awaits the period write before completing the transaction', async () => {
    let finish!: () => void;
    let transactionCompleted = false;
    mockAccountingPeriodRepo.create.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    mockRepoService.runInTransaction.mockImplementation(async (fn) => {
      const result = await fn(tx);
      transactionCompleted = true;
      return result;
    });
    const pending = execute(payload);
    await new Promise(process.nextTick);
    expect(mockAccountingPeriodRepo.create).toHaveBeenCalledTimes(1);
    expect(transactionCompleted).toBe(false);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    finish();
    await pending;
    expect(transactionCompleted).toBe(true);
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
  });

  it('waits for transaction completion before publishing or returning the interval', async () => {
    let finish!: () => void;
    let returned = false;
    mockRepoService.runInTransaction.mockImplementation(async (fn) => {
      const result = await fn(tx);
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      return result;
    });
    const pending = execute(payload).then((result) => {
      returned = true;
      return result;
    });
    await new Promise(process.nextTick);
    expect(mockAccountingIntervalRepo.create).toHaveBeenCalledTimes(1);
    expect(mockAccountingPeriodRepo.create).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    expect(returned).toBe(false);
    finish();
    await expect(pending).resolves.toBe(interval);
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
  });

  it('propagates commit failure after both writes without publishing', async () => {
    const failure = new Error('commit failed');
    mockRepoService.runInTransaction.mockImplementation(async (fn) => {
      await fn(tx);
      throw failure;
    });
    await expect(execute(payload)).rejects.toBe(failure);
    expect(mockAccountingIntervalRepo.create).toHaveBeenCalledTimes(1);
    expect(mockAccountingPeriodRepo.create).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('propagates transaction acquisition failure without writing or publishing', async () => {
    const failure = new Error('transaction unavailable');
    mockRepoService.runInTransaction.mockRejectedValue(failure);
    await expect(execute(payload)).rejects.toBe(failure);
    expect(mockAccountingIntervalRepo.create).not.toHaveBeenCalled();
    expect(mockAccountingPeriodRepo.create).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });
});
