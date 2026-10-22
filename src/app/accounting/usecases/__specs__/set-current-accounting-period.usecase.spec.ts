import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import generateUUID from '@shared/utils/uuid-generator';
import appError from '@shared/values/errors/app.error';
import historyValue from '@shared/values/history/history.vo';

import accountingIntervalEntity from '@domain/accounting/entities/accounting-interval.entity';
import actorEntity from '@domain/user/entities/actor.entity';

import { mockAccountingIntervalRepo } from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import { INextCurrentAccountingPeriodDto } from '@app/accounting/dtos/current-accounting-period/current-accounting-period.dto';
import accountingAppError from '@app/accounting/errors/accounting.error';
import makeSetCurrentAccountingPeriodUsecase from '@app/accounting/usecases/set-current-accounting-period.usecase';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';

describe('setCurrentAccountingPeriodUsecase', () => {
  const actor = actorEntity.makeSystem(actorEntity.makeMigration()[0].id)[0];
  const correlationId = 'set-current-period';
  let currentInterval: ReturnType<typeof accountingIntervalEntity.make>[0];
  let transition: ReturnType<
    typeof accountingIntervalEntity.updateCurrentPeriod
  >;
  let payload: INextCurrentAccountingPeriodDto;
  const execute = makeSetCurrentAccountingPeriodUsecase({
    appContext: mockAppContext,
    accountingIntervalRepo: mockAccountingIntervalRepo,
    eventBus: mockEventBus,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-01-15T10:00:00Z'));
    [currentInterval] = accountingIntervalEntity.make({
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
    transition = accountingIntervalEntity.updateCurrentPeriod(currentInterval);
    payload = {
      accountingEntityId: currentInterval.accountingEntityId,
      accountingIntervalId: currentInterval.id,
    };
    mockAppContext.get.mockReturnValue({
      actor,
      correlationId,
      idempotencyKey: '',
    });
    mockAccountingIntervalRepo.findById.mockResolvedValue(currentInterval);
    mockAccountingIntervalRepo.update.mockResolvedValue(undefined);
  });

  afterEach(() => jest.useRealTimers());

  it('loads the interval within its entity and persists the current selection with history', async () => {
    const [interval, events, audit] = transition;

    await expect(execute(payload)).resolves.toBeUndefined();

    expect(mockAppContext.get).toHaveBeenCalledWith(['actor']);
    expect(mockAccountingIntervalRepo.findById).toHaveBeenCalledWith(
      payload.accountingEntityId,
      payload.accountingIntervalId,
      { correlationId }
    );
    expect(mockAccountingIntervalRepo.update).toHaveBeenCalledWith(interval, {
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

  it.each(['accountingEntityId', 'accountingIntervalId'])(
    'rejects an invalid %s before reading context or storage',
    async (field) => {
      await expect(execute({ ...payload, [field]: 'invalid' })).rejects.toThrow(
        appError.UnprocessableEntity
      );
      expect(mockAppContext.get).not.toHaveBeenCalled();
      expect(mockAccountingIntervalRepo.findById).not.toHaveBeenCalled();
      expect(mockAccountingIntervalRepo.update).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    }
  );

  it('rejects the old period fields', async () => {
    const oldPayload = { ...payload, currentPeriodId: generateUUID() };
    await expect(execute(oldPayload)).rejects.toThrow(
      appError.UnprocessableEntity
    );
    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockAccountingIntervalRepo.findById).not.toHaveBeenCalled();
  });

  it('does not read storage when actor context is unavailable', async () => {
    const failure = new Error('Actor context unavailable');
    mockAppContext.get.mockImplementation(() => {
      throw failure;
    });
    await expect(execute(payload)).rejects.toBe(failure);
    expect(mockAccountingIntervalRepo.findById).not.toHaveBeenCalled();
  });

  it('rejects an interval not found within the supplied entity', async () => {
    mockAccountingIntervalRepo.findById.mockResolvedValue(null);
    await expect(execute(payload)).rejects.toBeInstanceOf(
      accountingAppError.AccountingIntervalNotFound
    );
    expect(mockAccountingIntervalRepo.update).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('does not persist when lookup fails', async () => {
    const failure = new Error('Read failed');
    mockAccountingIntervalRepo.findById.mockRejectedValue(failure);
    await expect(execute(payload)).rejects.toBe(failure);
    expect(mockAccountingIntervalRepo.update).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('skips persistence, history and events when the current selection is unchanged', async () => {
    jest.setSystemTime(new Date('2026-01-25'));
    await execute(payload);
    expect(mockAccountingIntervalRepo.update).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('rereads persisted state so a repeated job produces no additional writes or events', async () => {
    await execute(payload);
    mockAccountingIntervalRepo.findById.mockResolvedValue(transition[0]);
    await execute(payload);
    expect(mockAccountingIntervalRepo.findById).toHaveBeenCalledTimes(2);
    expect(mockAccountingIntervalRepo.update).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
  });

  it('propagates persistence failures without publishing', async () => {
    const failure = new Error('Update failed');
    mockAccountingIntervalRepo.update.mockRejectedValue(failure);
    await expect(execute(payload)).rejects.toBe(failure);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('publishes only after the interval and history write finishes', async () => {
    let finish!: () => void;
    mockAccountingIntervalRepo.update.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      })
    );
    const running = execute(payload);
    await Promise.resolve();
    expect(mockAccountingIntervalRepo.update).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    finish();
    await running;
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
  });

  it('propagates event publication failures after persistence', async () => {
    const failure = new Error('Publish failed');
    mockEventBus.publish.mockRejectedValue(failure);
    await expect(execute(payload)).rejects.toBe(failure);
    expect(mockAccountingIntervalRepo.update).toHaveBeenCalledTimes(1);
  });
});
