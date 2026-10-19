import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService from '@shared/contracts/__mocks__/repo.mock';
import { ITransactionContext } from '@shared/types/repo.types';
import generateUUID from '@shared/utils/uuid-generator';
import appError from '@shared/values/errors/app.error';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import accountingPeriodEntity from '@domain/accounting/entities/accounting-period.entity';
import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';
import periodError from '@domain/accounting/errors/period.error';
import makeAccountingPeriodService from '@domain/accounting/services/accounting-period.service';
import actorEntity from '@domain/user/entities/actor.entity';
import { IUser } from '@domain/user/types/user.types';

import {
  mockAccountingContextRepo,
  mockAccountingEntityRepo,
  mockAccountingPeriodRepo,
  mockFiscalYearRepo,
  mockReportingContextRepo,
  mockReportingPeriodRepo,
} from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import { IAccountingPeriodsCreationReq } from '@app/accounting/dtos/accounting-period/accounting-period.dto';
import accountingPeriodDtoMapper from '@app/accounting/dtos/accounting-period/accounting-period.dto.mapper';
import accountingAppError from '@app/accounting/errors/accounting.error';
import makeCreateAccountingPeriodsUsecase from '@app/accounting/usecases/create-accounting-periods.usecase';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';

describe('makeCreateAccountingPeriodsUsecase', () => {
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
  const payload: IAccountingPeriodsCreationReq = {
    fiscalYearId: year.id,
    unit: 'month',
    count: 12,
  };
  const tx: ITransactionContext = {};
  const correlationId = 'create-accounting-periods';
  const accountingPeriodService = makeAccountingPeriodService({
    accountingPeriodRepo: mockAccountingPeriodRepo,
  });
  const execute = makeCreateAccountingPeriodsUsecase({
    appContext: mockAppContext,
    fiscalYearRepo: mockFiscalYearRepo,
    accountingPeriodService,
    accountingPeriodRepo: mockAccountingPeriodRepo,
    repoService: mockRepoService,
    eventBus: mockEventBus,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      actor,
      accountingEntity: entity,
      user: { id: userId } as IUser,
      correlationId,
    } as ReturnType<typeof mockAppContext.get>);
    mockFiscalYearRepo.findById.mockResolvedValue(year);
    mockAccountingPeriodRepo.findByRange.mockResolvedValue([]);
    mockRepoService.runInTransaction.mockImplementation(async (write) =>
      write(tx)
    );
  });

  it('uses the required context entity and persists only its complete period set with histories', async () => {
    const result = await execute(payload);
    expect(mockAppContext.get).toHaveBeenCalledWith([
      'accountingEntity',
      'actor',
    ]);
    expect(mockAccountingEntityRepo.findById).not.toHaveBeenCalled();
    expect(mockFiscalYearRepo.findById).toHaveBeenCalledWith(year.id, {
      correlationId,
    });
    expect(mockAccountingPeriodRepo.findByRange).toHaveBeenCalledWith(
      entity.id,
      {
        startDate: year.startDate,
        endDate: year.endDate,
      },
      { correlationId }
    );
    const [saved, options] = mockAccountingPeriodRepo.create.mock.calls[0];
    const periods = Array.isArray(saved) ? saved : [saved];
    const histories = Array.isArray(options.history)
      ? options.history
      : [options.history];
    expect(result).toEqual(periods.map(accountingPeriodDtoMapper.toDto));
    expect(result).toHaveLength(12);
    expect(result[0].startDate).toEqual(year.startDate);
    expect(result[11].endDate).toEqual(year.endDate);
    expect(result[1].endDate).toEqual(new Date('2092-02-29'));
    expect(options).toEqual({ correlationId, tx, history: histories });
    expect(histories).toHaveLength(periods.length);
    periods.forEach((period, index) => {
      expect(histories[index]).toMatchObject({
        entityId: period.id,
        actorId: actor.id,
        correlationId,
        diff: { after: JSON.parse(JSON.stringify(period)) as unknown },
      });
      expect(period.accountingEntityId).toBe(entity.id);
      expect(period.fiscalYearId).toBe(year.id);
      if (index > 0) {
        expect(
          period.startDate.getTime() - periods[index - 1].endDate.getTime()
        ).toBe(86400000);
      }
    });
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      periods.map((period) =>
        expect.objectContaining({ data: period, correlationId })
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

  it('rejects a missing fiscal year without writing', async () => {
    mockFiscalYearRepo.findById.mockResolvedValue(null);
    await expect(execute(payload)).rejects.toBeInstanceOf(
      accountingAppError.FiscalYearNotFound
    );
    expect(mockAccountingPeriodRepo.findByRange).not.toHaveBeenCalled();
    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
  });

  it('rejects a fiscal year belonging to another entity before period lookup', async () => {
    mockFiscalYearRepo.findById.mockResolvedValue({
      ...year,
      accountingEntityId: generateUUID(),
    });
    await expect(execute(payload)).rejects.toBeInstanceOf(
      periodError.InvalidAccountingEntityId
    );
    expect(mockAccountingPeriodRepo.findByRange).not.toHaveBeenCalled();
    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
  });

  it('rejects existing overlapping periods without writing or publishing', async () => {
    const [creation] = accountingPeriodEntity.make({
      accountingEntityId: entity.id,
      createdBy: actor.id,
      fiscalYear: year,
      unit: 'month',
      count: 12,
    });
    mockAccountingPeriodRepo.findByRange.mockResolvedValue([creation[0]]);
    await expect(execute(payload)).rejects.toBeInstanceOf(
      periodError.OverlappingPeriods
    );
    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('propagates invalid generation parameters without writing', async () => {
    await expect(execute({ ...payload, count: 13 })).rejects.toBeInstanceOf(
      periodError.InvalidInterval
    );
    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
  });

  it.each([
    { accountingEntityId: 'invalid' },
    { fiscalYearId: 'invalid' },
    { unit: 'invalid' },
    { count: 0 },
    { count: 1.5 },
    { createdBy: userId },
  ])('rejects malformed input before reads: %j', async (change) => {
    await expect(
      execute({ ...payload, ...change } as IAccountingPeriodsCreationReq)
    ).rejects.toBeInstanceOf(appError.UnprocessableEntity);
    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockAccountingEntityRepo.findById).not.toHaveBeenCalled();
  });

  it.each([new Error('history failed'), new periodError.OverlappingPeriods()])(
    'propagates persistence failure without publication',
    async (failure) => {
      mockAccountingPeriodRepo.create.mockRejectedValue(failure);
      await expect(execute(payload)).rejects.toBe(failure);
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    }
  );

  it('does not publish if the outer commit fails', async () => {
    const failure = new Error('commit failed');
    mockRepoService.runInTransaction.mockImplementation(async (write) => {
      await write(tx);
      throw failure;
    });
    await expect(execute(payload)).rejects.toBe(failure);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('waits until the outer transaction commits before publishing', async () => {
    let commit!: () => void;
    mockRepoService.runInTransaction.mockImplementation(async (write) => {
      await write(tx);
      await new Promise<void>((resolve) => {
        commit = resolve;
      });
    });
    const pending = execute(payload);
    await new Promise(process.nextTick);
    expect(mockAccountingPeriodRepo.create).toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    commit();
    await pending;
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
  });
});
