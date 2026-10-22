import generateUUID from '@shared/utils/uuid-generator';

import mockCurrentReportingPeriodQueue from '@app/accounting/contracts/__mocks__/current-reporting-period-queue.mock';
import { INextCurrentReportingPeriodDto } from '@app/accounting/dtos/current-reporting-period/current-reporting-period.dto';
import makeCurrentReportingPeriodSchedulerWorker from '@app/accounting/workers/current-reporting-period-scheduler.worker';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';

describe('current reporting period scheduler worker', () => {
  const periods: INextCurrentReportingPeriodDto[] = [1, 2].map(() => ({
    accountingEntityId: generateUUID(),
    reportingIntervalId: generateUUID(),
  }));
  const usecase = jest.fn<Promise<INextCurrentReportingPeriodDto[]>, []>();
  const worker = makeCurrentReportingPeriodSchedulerWorker({
    appContext: mockAppContext,
    usecase,
    queue: mockCurrentReportingPeriodQueue,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      correlationId: 'scheduler-correlation',
      idempotencyKey: '',
    });
    usecase.mockResolvedValue(periods);
    mockCurrentReportingPeriodQueue.add.mockResolvedValue(undefined);
  });

  it('discovers due transitions and enqueues each DTO directly', async () => {
    await worker();

    expect(usecase).toHaveBeenCalledWith();
    expect(usecase).toHaveBeenCalledTimes(1);
    expect(mockCurrentReportingPeriodQueue.add.mock.calls).toEqual(
      periods.map((period) => ['scheduler-correlation', period])
    );
  });

  it('does not enqueue when no periods are due', async () => {
    usecase.mockResolvedValue([]);
    await worker();
    expect(mockCurrentReportingPeriodQueue.add).not.toHaveBeenCalled();
  });

  it('propagates discovery failure without enqueueing', async () => {
    const failure = new Error('Discovery failed');
    usecase.mockRejectedValue(failure);
    await expect(worker()).rejects.toBe(failure);
    expect(mockCurrentReportingPeriodQueue.add).not.toHaveBeenCalled();
  });

  it('waits for queue acceptance before enqueueing the next transition', async () => {
    let accept!: () => void;
    mockCurrentReportingPeriodQueue.add.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        accept = resolve;
      })
    );
    const running = worker();
    await Promise.resolve();
    expect(mockCurrentReportingPeriodQueue.add).toHaveBeenCalledTimes(1);
    accept();
    await running;
    expect(mockCurrentReportingPeriodQueue.add).toHaveBeenCalledTimes(2);
  });

  it('propagates enqueue failure to the scheduler', async () => {
    const failure = new Error('Queue unavailable');
    mockCurrentReportingPeriodQueue.add.mockRejectedValueOnce(failure);
    await expect(worker()).rejects.toBe(failure);
    expect(mockCurrentReportingPeriodQueue.add).toHaveBeenCalledTimes(1);
  });
});
