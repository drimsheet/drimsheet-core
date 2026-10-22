import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import generateUUID from '@shared/utils/uuid-generator';
import appError from '@shared/values/errors/app.error';
import historyValue from '@shared/values/history/history.vo';

import reportingIntervalEntity from '@domain/accounting/entities/reporting-interval.entity';
import actorEntity from '@domain/user/entities/actor.entity';

import { mockReportingIntervalRepo } from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import { INextCurrentReportingPeriodDto } from '@app/accounting/dtos/current-reporting-period/current-reporting-period.dto';
import accountingAppError from '@app/accounting/errors/accounting.error';
import makeSetCurrentReportingPeriodUsecase from '@app/accounting/usecases/set-current-reporting-period.usecase';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';

describe('setCurrentReportingPeriodUsecase', () => {
  const actor = actorEntity.makeSystem(actorEntity.makeMigration()[0].id)[0];
  const correlationId = 'set-current-period';
  let currentInterval: ReturnType<typeof reportingIntervalEntity.make>[0];
  let transition: ReturnType<
    typeof reportingIntervalEntity.updateCurrentPeriod
  >;
  let payload: INextCurrentReportingPeriodDto;
  const execute = makeSetCurrentReportingPeriodUsecase({
    appContext: mockAppContext,
    reportingIntervalRepo: mockReportingIntervalRepo,
    eventBus: mockEventBus,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-01-15T10:00:00Z'));
    [currentInterval] = reportingIntervalEntity.make({
      createdBy: actor.id,
      accountingEntityId: generateUUID(),
      fiscalYearId: generateUUID(),
      unit: 'month',
      count: 4,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-05-01'),
      periods: ['January', 'February', 'March', 'April'].map((name) => ({
        name,
      })),
    });
    jest.setSystemTime(new Date('2026-03-15T10:00:00Z'));
    transition = reportingIntervalEntity.updateCurrentPeriod(currentInterval);
    payload = {
      accountingEntityId: currentInterval.accountingEntityId,
      reportingIntervalId: currentInterval.id,
    };
    mockAppContext.get.mockReturnValue({
      actor,
      correlationId,
      idempotencyKey: '',
    });
    mockReportingIntervalRepo.findById.mockResolvedValue(currentInterval);
    mockReportingIntervalRepo.update.mockResolvedValue(undefined);
  });

  afterEach(() => jest.useRealTimers());

  it('loads the interval within its entity and persists the current selection with history', async () => {
    const [interval, events, audit] = transition;

    await expect(execute(payload)).resolves.toBeUndefined();

    expect(mockAppContext.get).toHaveBeenCalledWith(['actor']);
    expect(mockReportingIntervalRepo.findById).toHaveBeenCalledWith(
      payload.accountingEntityId,
      payload.reportingIntervalId,
      { correlationId }
    );
    expect(mockReportingIntervalRepo.update).toHaveBeenCalledWith(interval, {
      correlationId,
      history: historyValue.make(audit!, actor.id, correlationId),
    });
    expect(interval.currentPeriodOrdinal).toBe(2);
    expect(interval.nextPeriodStartDate).toEqual(new Date('2026-04-01'));
    expect(interval.periods).toBe(currentInterval.periods);
    expect(mockEventBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        type: events[0].type,
        data: interval,
        correlationId,
      }),
    ]);
  });

  it.each(['accountingEntityId', 'reportingIntervalId'])(
    'rejects an invalid %s before reading context or storage',
    async (field) => {
      await expect(execute({ ...payload, [field]: 'invalid' })).rejects.toThrow(
        appError.UnprocessableEntity
      );
      expect(mockAppContext.get).not.toHaveBeenCalled();
      expect(mockReportingIntervalRepo.findById).not.toHaveBeenCalled();
      expect(mockReportingIntervalRepo.update).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    }
  );

  it('rejects the old period fields', async () => {
    const oldPayload = { ...payload, currentPeriodId: generateUUID() };
    await expect(execute(oldPayload)).rejects.toThrow(
      appError.UnprocessableEntity
    );
    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockReportingIntervalRepo.findById).not.toHaveBeenCalled();
  });

  it('does not read storage when actor context is unavailable', async () => {
    const failure = new Error('Actor context unavailable');
    mockAppContext.get.mockImplementation(() => {
      throw failure;
    });
    await expect(execute(payload)).rejects.toBe(failure);
    expect(mockReportingIntervalRepo.findById).not.toHaveBeenCalled();
  });

  it('rejects an interval not found within the supplied entity', async () => {
    mockReportingIntervalRepo.findById.mockResolvedValue(null);
    await expect(execute(payload)).rejects.toBeInstanceOf(
      accountingAppError.ReportingIntervalNotFound
    );
    expect(mockReportingIntervalRepo.update).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('does not persist when lookup fails', async () => {
    const failure = new Error('Read failed');
    mockReportingIntervalRepo.findById.mockRejectedValue(failure);
    await expect(execute(payload)).rejects.toBe(failure);
    expect(mockReportingIntervalRepo.update).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('skips persistence, history and events when the current selection is unchanged', async () => {
    jest.setSystemTime(new Date('2026-01-25'));
    await execute(payload);
    expect(mockReportingIntervalRepo.update).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('rereads persisted state so a repeated job produces no additional writes or events', async () => {
    await execute(payload);
    mockReportingIntervalRepo.findById.mockResolvedValue(transition[0]);
    await execute(payload);
    expect(mockReportingIntervalRepo.findById).toHaveBeenCalledTimes(2);
    expect(mockReportingIntervalRepo.update).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
  });

  it('propagates persistence failures without publishing', async () => {
    const failure = new Error('Update failed');
    mockReportingIntervalRepo.update.mockRejectedValue(failure);
    await expect(execute(payload)).rejects.toBe(failure);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('publishes only after the interval and history write finishes', async () => {
    let finish!: () => void;
    mockReportingIntervalRepo.update.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      })
    );
    const running = execute(payload);
    await Promise.resolve();
    expect(mockReportingIntervalRepo.update).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    finish();
    await running;
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
  });

  it('propagates event publication failures after persistence', async () => {
    const failure = new Error('Publish failed');
    mockEventBus.publish.mockRejectedValue(failure);
    await expect(execute(payload)).rejects.toBe(failure);
    expect(mockReportingIntervalRepo.update).toHaveBeenCalledTimes(1);
  });
});
