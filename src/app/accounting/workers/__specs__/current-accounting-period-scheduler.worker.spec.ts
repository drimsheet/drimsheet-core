import generateUUID from '@shared/utils/uuid-generator';

import mockCurrentAccountingPeriodQueue from '@app/accounting/contracts/__mocks__/current-accounting-period-queue.mock';
import { INextCurrentAccountingPeriodDto } from '@app/accounting/dtos/current-accounting-period/current-accounting-period.dto';
import makeCurrentAccountingPeriodSchedulerWorker from '@app/accounting/workers/current-accounting-period-scheduler.worker';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';

describe('current accounting period scheduler worker', () => {
  const periods: INextCurrentAccountingPeriodDto[] = [1, 2].map(() => ({
    accountingContextId: generateUUID(),
    fiscalYearId: generateUUID(),
    accountingEntityId: generateUUID(),
    currentPeriodId: generateUUID(),
    nextPeriodId: generateUUID(),
  }));
  const usecase = jest.fn<Promise<INextCurrentAccountingPeriodDto[]>, []>();
  const worker = makeCurrentAccountingPeriodSchedulerWorker({
    appContext: mockAppContext,
    usecase,
    queue: mockCurrentAccountingPeriodQueue,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      correlationId: 'scheduler-correlation',
      idempotencyKey: '',
    });
    usecase.mockResolvedValue(periods);
    mockCurrentAccountingPeriodQueue.add.mockResolvedValue(undefined);
  });

  it('discovers due transitions and enqueues each DTO directly', async () => {
    await worker();

    expect(usecase).toHaveBeenCalledWith();
    expect(usecase).toHaveBeenCalledTimes(1);
    expect(mockCurrentAccountingPeriodQueue.add.mock.calls).toEqual(
      periods.map((period) => ['scheduler-correlation', period])
    );
  });

  it('does not enqueue when no periods are due', async () => {
    usecase.mockResolvedValue([]);
    await worker();
    expect(mockCurrentAccountingPeriodQueue.add).not.toHaveBeenCalled();
  });

  it('propagates discovery failure without enqueueing', async () => {
    const failure = new Error('Discovery failed');
    usecase.mockRejectedValue(failure);
    await expect(worker()).rejects.toBe(failure);
    expect(mockCurrentAccountingPeriodQueue.add).not.toHaveBeenCalled();
  });

  it('waits for queue acceptance before enqueueing the next transition', async () => {
    let accept!: () => void;
    mockCurrentAccountingPeriodQueue.add.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        accept = resolve;
      })
    );
    const running = worker();
    await Promise.resolve();
    expect(mockCurrentAccountingPeriodQueue.add).toHaveBeenCalledTimes(1);
    accept();
    await running;
    expect(mockCurrentAccountingPeriodQueue.add).toHaveBeenCalledTimes(2);
  });

  it('propagates enqueue failure to the scheduler', async () => {
    const failure = new Error('Queue unavailable');
    mockCurrentAccountingPeriodQueue.add.mockRejectedValueOnce(failure);
    await expect(worker()).rejects.toBe(failure);
    expect(mockCurrentAccountingPeriodQueue.add).toHaveBeenCalledTimes(1);
  });
});
