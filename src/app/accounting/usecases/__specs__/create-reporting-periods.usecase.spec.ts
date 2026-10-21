import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import generateUUID from '@shared/utils/uuid-generator';
import appError from '@shared/values/errors/app.error';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';
import reportingPeriodEntity from '@domain/accounting/entities/reporting-period.entity';
import periodError from '@domain/accounting/errors/period.error';
import makeReportingPeriodService from '@domain/accounting/services/reporting-period.service';
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
import { IReportingPeriodsCreationReq } from '@app/accounting/dtos/reporting-period/reporting-period.dto';
import accountingAppError from '@app/accounting/errors/accounting.error';
import makeCreateReportingPeriodsUsecase from '@app/accounting/usecases/create-reporting-periods.usecase';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';

describe('makeCreateReportingPeriodsUsecase', () => {
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
  const payload: IReportingPeriodsCreationReq = {
    fiscalYearId: year.id,
    unit: 'month',
    count: 12,
  };
  const existingPeriods = reportingPeriodEntity
    .make({
      accountingEntityId: entity.id,
      createdBy: actor.id,
      fiscalYear: year,
      unit: 'quarter',
      count: 4,
    })
    .map(([period]) => period);
  const correlationId = 'create-reporting-periods';
  const reportingPeriodService = makeReportingPeriodService({
    reportingPeriodRepo: mockReportingPeriodRepo,
  });
  const execute = makeCreateReportingPeriodsUsecase({
    appContext: mockAppContext,
    fiscalYearRepo: mockFiscalYearRepo,
    reportingPeriodService,
    reportingPeriodRepo: mockReportingPeriodRepo,
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
    mockReportingPeriodRepo.findAllByFiscalYear.mockResolvedValue([]);
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
    expect(mockReportingPeriodRepo.findAllByFiscalYear).toHaveBeenCalledWith(
      entity.id,
      year.id,
      { correlationId }
    );
    const [saved, options] = mockReportingPeriodRepo.create.mock.calls[0];
    const periods = Array.isArray(saved) ? saved : [saved];
    const histories = Array.isArray(options.history)
      ? options.history
      : [options.history];
    expect(result).toBe(periods);
    expect(result).toHaveLength(12);
    expect(result[0].startDate).toEqual(year.startDate);
    expect(result[11].endDate).toEqual(year.endDate);
    expect(result[1].endDate).toEqual(new Date('2092-02-29'));
    expect(options).toEqual({ correlationId, history: histories });
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
      mockAccountingPeriodRepo,
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
    expect(mockReportingPeriodRepo.findAllByFiscalYear).not.toHaveBeenCalled();
    expect(mockReportingPeriodRepo.create).not.toHaveBeenCalled();
  });

  it('rejects a fiscal year belonging to another entity before period lookup', async () => {
    mockFiscalYearRepo.findById.mockResolvedValue({
      ...year,
      accountingEntityId: generateUUID(),
    });
    await expect(execute(payload)).rejects.toBeInstanceOf(
      periodError.InvalidAccountingEntityId
    );
    expect(mockReportingPeriodRepo.findAllByFiscalYear).not.toHaveBeenCalled();
    expect(mockReportingPeriodRepo.create).not.toHaveBeenCalled();
  });

  it('rejects repeated generation without writing or publishing', async () => {
    mockReportingPeriodRepo.findAllByFiscalYear.mockResolvedValue(
      existingPeriods
    );
    await expect(execute(payload)).rejects.toBeInstanceOf(
      periodError.DuplicateReportingPeriods
    );
    expect(mockReportingPeriodRepo.create).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('propagates invalid generation parameters without writing', async () => {
    await expect(execute({ ...payload, count: 13 })).rejects.toBeInstanceOf(
      periodError.InvalidInterval
    );
    expect(mockReportingPeriodRepo.create).not.toHaveBeenCalled();
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
      execute({ ...payload, ...change } as IReportingPeriodsCreationReq)
    ).rejects.toBeInstanceOf(appError.UnprocessableEntity);
    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockAccountingEntityRepo.findById).not.toHaveBeenCalled();
  });

  it.each([
    new Error('history failed'),
    new Error('commit failed'),
    new periodError.DuplicateReportingPeriods(),
  ])('propagates persistence failure without publishing', async (failure) => {
    mockReportingPeriodRepo.create.mockRejectedValue(failure);
    await expect(execute(payload)).rejects.toBe(failure);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('waits for repository completion before publishing', async () => {
    let completeWrite!: () => void;
    mockReportingPeriodRepo.create.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          completeWrite = resolve;
        })
    );
    const pending = execute(payload);
    await new Promise(process.nextTick);
    expect(mockReportingPeriodRepo.create).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    completeWrite();
    await pending;
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
  });

  it('propagates publication failure without repeating persistence', async () => {
    const failure = new Error('publication failed');
    mockEventBus.publish.mockRejectedValue(failure);
    await expect(execute(payload)).rejects.toBe(failure);
    expect(mockReportingPeriodRepo.create).toHaveBeenCalledTimes(1);
  });
});
