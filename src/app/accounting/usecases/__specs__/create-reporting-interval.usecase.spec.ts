import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService, {
  mockRepoTransaction,
} from '@shared/contracts/__mocks__/repo.mock';
import generateUUID from '@shared/utils/uuid-generator';
import appError from '@shared/values/errors/app.error';
import periodError from '@shared/values/interval/period.error';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';
import actorEntity from '@domain/user/entities/actor.entity';

import {
  mockAccountingContextRepo,
  mockAccountingEntityRepo,
  mockFiscalYearRepo,
  mockReportingContextRepo,
  mockReportingIntervalRepo,
  mockReportingPeriodRepo,
} from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import { IReportingIntervalCreationReq } from '@app/accounting/dtos/reporting-interval/reporting-interval.dto';
import accountingAppError from '@app/accounting/errors/accounting.error';
import makeCreateReportingIntervalUsecase from '@app/accounting/usecases/create-reporting-interval.usecase';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';

describe('makeCreateReportingIntervalUsecase', () => {
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
  const payload: IReportingIntervalCreationReq = {
    fiscalYearId: year.id,
    unit: 'month',
    count: 12,
    periods: Array.from({ length: 12 }, (_, index) => ({
      name: `Month ${index + 1}`,
    })),
  };
  const correlationId = 'create-reporting-interval';
  const tx = mockRepoTransaction.context;
  const execute = makeCreateReportingIntervalUsecase({
    appContext: mockAppContext,
    fiscalYearRepo: mockFiscalYearRepo,
    reportingIntervalRepo: mockReportingIntervalRepo,
    reportingPeriodRepo: mockReportingPeriodRepo,
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
  });

  it('persists interval and periods separately with their histories in one transaction', async () => {
    const interval = await execute(payload);
    expect(mockAppContext.get).toHaveBeenCalledWith([
      'accountingEntity',
      'actor',
    ]);
    expect(mockFiscalYearRepo.findById).toHaveBeenCalledWith(
      entity.id,
      year.id,
      { correlationId }
    );
    expect(interval).toMatchObject({
      accountingEntityId: entity.id,
      fiscalYearId: year.id,
      createdBy: actor.id,
      unit: payload.unit,
      count: payload.count,
      periods: payload.periods,
      startDate: year.startDate,
      endDate: new Date('2093-01-01'),
    });
    expect(mockReportingIntervalRepo.create).toHaveBeenCalledTimes(1);
    const [saved, options] = mockReportingIntervalRepo.create.mock.calls[0];
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
    expect(mockReportingPeriodRepo.create).toHaveBeenCalledTimes(1);
    expect(mockReportingPeriodRepo.create).toHaveBeenCalledWith(periods, {
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
    expect(mockReportingPeriodRepo.create.mock.calls[0][1].tx).toBe(tx);
    expect(mockRepoService.runInTransaction).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'domain:accounting:reporting-interval:created',
        data: interval,
        correlationId,
        enrichedAt: expect.any(Date),
      }),
      ...periods.map((period) =>
        expect.objectContaining({
          type: 'domain:accounting:reporting-period:created',
          data: period,
          correlationId,
          enrichedAt: expect.any(Date),
        })
      ),
    ]);
    for (const repo of [
      mockAccountingEntityRepo,
      mockFiscalYearRepo,
      mockAccountingContextRepo,
      mockReportingContextRepo,
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
    expect(mockReportingIntervalRepo.create).not.toHaveBeenCalled();
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
    expect(mockReportingIntervalRepo.create).not.toHaveBeenCalled();
    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
  });

  it('propagates fiscal-year read failures', async () => {
    const failure = new Error('read failed');
    mockFiscalYearRepo.findById.mockRejectedValue(failure);
    await expect(execute(payload)).rejects.toBe(failure);
    expect(mockReportingIntervalRepo.create).not.toHaveBeenCalled();
    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
  });

  it('propagates domain rejection without persisting or publishing', async () => {
    await expect(execute({ ...payload, periods: [] })).rejects.toBeInstanceOf(
      periodError.InvalidPeriods
    );
    expect(mockReportingIntervalRepo.create).not.toHaveBeenCalled();
    expect(mockReportingPeriodRepo.create).not.toHaveBeenCalled();
    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('maps quarter units and period names into the created interval', async () => {
    const request: IReportingIntervalCreationReq = {
      ...payload,
      unit: 'quarter',
      count: 4,
      periods: Array.from({ length: 4 }, (_, index) => ({
        name: `Quarter ${index + 1}`,
      })),
    };
    const interval = await execute(request);
    expect(interval).toMatchObject({
      unit: 'quarter',
      count: 4,
      periods: request.periods,
      startDate: year.startDate,
      endDate: new Date('2093-01-01'),
    });
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
      execute({ ...payload, ...change } as IReportingIntervalCreationReq)
    ).rejects.toBeInstanceOf(appError.UnprocessableEntity);
    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockFiscalYearRepo.findById).not.toHaveBeenCalled();
    expect(mockReportingIntervalRepo.create).not.toHaveBeenCalled();
    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('propagates persistence failure without publishing', async () => {
    const failure = new Error('history failed');
    mockReportingIntervalRepo.create.mockRejectedValue(failure);
    await expect(execute(payload)).rejects.toBe(failure);
    expect(mockReportingPeriodRepo.create).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('awaits the fiscal-year lookup before persisting', async () => {
    let finish!: () => void;
    mockFiscalYearRepo.findById.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve(year);
        })
    );
    const pending = execute(payload);
    await new Promise(process.nextTick);
    expect(mockReportingIntervalRepo.create).not.toHaveBeenCalled();
    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    finish();
    await pending;
    expect(mockReportingIntervalRepo.create).toHaveBeenCalledTimes(1);
  });

  it('awaits the interval write before writing periods or publishing', async () => {
    let finish!: () => void;
    mockReportingIntervalRepo.create.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    const pending = execute(payload);
    await new Promise(process.nextTick);
    expect(mockReportingIntervalRepo.create).toHaveBeenCalledTimes(1);
    expect(mockReportingPeriodRepo.create).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    finish();
    await pending;
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
  });

  it('propagates a period write failure through the transaction without publishing', async () => {
    const failure = new Error('period history failed');
    mockReportingPeriodRepo.create.mockRejectedValue(failure);
    await expect(execute(payload)).rejects.toBe(failure);
    expect(mockReportingIntervalRepo.create).toHaveBeenCalledTimes(1);
    expect(mockReportingPeriodRepo.create).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('awaits the period write before completing the transaction', async () => {
    let finish!: () => void;
    let transactionCompleted = false;
    mockReportingPeriodRepo.create.mockImplementation(
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
    expect(mockReportingPeriodRepo.create).toHaveBeenCalledTimes(1);
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
    expect(mockReportingIntervalRepo.create).toHaveBeenCalledTimes(1);
    expect(mockReportingPeriodRepo.create).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    expect(returned).toBe(false);
    finish();
    await expect(pending).resolves.toEqual({
      ...mockReportingIntervalRepo.create.mock.calls[0][0],
      periods: mockReportingPeriodRepo.create.mock.calls[0][0],
    });
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
  });

  it('propagates commit failure after both writes without publishing', async () => {
    const failure = new Error('commit failed');
    mockRepoService.runInTransaction.mockImplementation(async (fn) => {
      await fn(tx);
      throw failure;
    });
    await expect(execute(payload)).rejects.toBe(failure);
    expect(mockReportingIntervalRepo.create).toHaveBeenCalledTimes(1);
    expect(mockReportingPeriodRepo.create).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('propagates transaction acquisition failure without writing or publishing', async () => {
    const failure = new Error('transaction unavailable');
    mockRepoService.runInTransaction.mockRejectedValue(failure);
    await expect(execute(payload)).rejects.toBe(failure);
    expect(mockReportingIntervalRepo.create).not.toHaveBeenCalled();
    expect(mockReportingPeriodRepo.create).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });
});
