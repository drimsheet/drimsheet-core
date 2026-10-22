import generateUUID from '@shared/utils/uuid-generator';

import actorEntity from '@domain/user/entities/actor.entity';

import { INextCurrentAccountingPeriodDto } from '@app/accounting/dtos/current-accounting-period/current-accounting-period.dto';
import makeSetCurrentAccountingPeriodWorker from '@app/accounting/workers/set-current-accounting-period.worker';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { mockActorService } from '@app/user/contracts/__mocks__/actor.services.mock';

describe('set current accounting period worker', () => {
  const correlationId = generateUUID();
  const [actor] = actorEntity.makeSystem(actorEntity.makeMigration()[0].id);
  const payload: INextCurrentAccountingPeriodDto = {
    accountingEntityId: generateUUID(),
    accountingIntervalId: generateUUID(),
  };
  const usecase = jest.fn<Promise<void>, [INextCurrentAccountingPeriodDto]>();
  const worker = makeSetCurrentAccountingPeriodWorker({
    actorService: mockActorService,
    appContext: mockAppContext,
    usecase,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({ correlationId, idempotencyKey: '' });
    mockActorService.resolveByUsername.mockResolvedValue(actor);
    usecase.mockResolvedValue(undefined);
  });

  it('uses context correlation and sets the system actor before updating', async () => {
    usecase.mockImplementation(async () => {
      expect(mockAppContext.set).toHaveBeenCalledWith({ actor });
    });

    await worker(payload);

    expect(mockActorService.resolveByUsername).toHaveBeenCalledWith(
      'drimsheet-core',
      { correlationId }
    );
    expect(usecase).toHaveBeenCalledTimes(1);
    expect(usecase).toHaveBeenCalledWith(payload);
  });

  it('propagates actor resolution failures without calling the usecase', async () => {
    const failure = new Error('Actor unavailable');
    mockActorService.resolveByUsername.mockRejectedValue(failure);

    await expect(worker(payload)).rejects.toBe(failure);

    expect(mockAppContext.set).not.toHaveBeenCalled();
    expect(usecase).not.toHaveBeenCalled();
  });

  it('propagates update failures to the queue for retry', async () => {
    const failure = new Error('Update failed');
    usecase.mockRejectedValue(failure);

    await expect(worker(payload)).rejects.toBe(failure);
  });
});
