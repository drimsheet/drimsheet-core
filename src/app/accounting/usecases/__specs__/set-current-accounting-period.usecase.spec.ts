import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import generateUUID from '@shared/utils/uuid-generator';
import appError from '@shared/values/errors/app.error';
import historyValue from '@shared/values/history/history.vo';

import accountingContextEntity from '@domain/accounting/entities/accounting-context.entity';
import actorEntity from '@domain/user/entities/actor.entity';

import { mockAccountingContextService } from '@app/accounting/contracts/__mocks__/accounting.domain.services.mock';
import { mockAccountingContextRepo } from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import { INextCurrentAccountingPeriodDto } from '@app/accounting/dtos/current-accounting-period/current-accounting-period.dto';
import makeSetCurrentAccountingPeriodUsecase from '@app/accounting/usecases/set-current-accounting-period.usecase';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';

describe('setCurrentAccountingPeriodUsecase', () => {
  const actor = actorEntity.makeSystem(actorEntity.makeMigration()[0].id)[0];
  const [previousContext] = accountingContextEntity.make({
    createdBy: generateUUID(),
    accountingEntityId: generateUUID(),
    fiscalYearId: generateUUID(),
    currentAccountingPeriodId: generateUUID(),
    previousAccountingPeriodId: null,
    nextAccountingPeriodId: generateUUID(),
    accountingStandardCode: 'IFRS',
    name: 'Working context',
    description: null,
  });
  const transition = accountingContextEntity.update(previousContext, {
    previousAccountingPeriodId: previousContext.currentAccountingPeriodId,
    currentAccountingPeriodId: previousContext.nextAccountingPeriodId!,
    nextAccountingPeriodId: null,
  });
  const [context, events, audit] = transition;
  const payload: INextCurrentAccountingPeriodDto = {
    accountingContextId: context.id,
    accountingEntityId: context.accountingEntityId,
    fiscalYearId: context.fiscalYearId,
    currentPeriodId: context.previousAccountingPeriodId!,
    nextPeriodId: context.currentAccountingPeriodId,
  };
  const correlationId = 'set-current-period';
  const execute = makeSetCurrentAccountingPeriodUsecase({
    appContext: mockAppContext,
    accountingContextService: mockAccountingContextService,
    accountingContextRepo: mockAccountingContextRepo,
    eventBus: mockEventBus,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      actor,
      correlationId,
      idempotencyKey: '',
    });
    mockAccountingContextService.updateCurrentAccountingPeriod.mockResolvedValue(
      transition
    );
    mockAccountingContextRepo.update.mockResolvedValue(undefined);
  });

  it('prepares the requested transition and persists the service result', async () => {
    await expect(execute(payload)).resolves.toBeUndefined();
    const previousState = {
      currentAccountPeriod: payload.currentPeriodId,
      nextAccountingPeriod: payload.nextPeriodId,
    };
    expect(mockAppContext.get).toHaveBeenCalledWith(['actor']);
    expect(
      mockAccountingContextService.updateCurrentAccountingPeriod
    ).toHaveBeenCalledWith(
      { accountingContextId: payload.accountingContextId, previousState },
      { correlationId }
    );
    expect(mockAccountingContextRepo.update).toHaveBeenCalledWith(context, {
      correlationId,
      history: historyValue.make(audit!, actor.id, correlationId),
    });
    expect(mockEventBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        type: events[0].type,
        data: context,
        correlationId,
      }),
    ]);
  });

  it.each([
    'accountingContextId',
    'accountingEntityId',
    'fiscalYearId',
    'currentPeriodId',
    'nextPeriodId',
  ])(
    'rejects an invalid %s before reading context or calling dependencies',
    async (field) => {
      await expect(execute({ ...payload, [field]: 'invalid' })).rejects.toThrow(
        appError.UnprocessableEntity
      );
      expect(mockAppContext.get).not.toHaveBeenCalled();
      expect(
        mockAccountingContextService.updateCurrentAccountingPeriod
      ).not.toHaveBeenCalled();
      expect(mockAccountingContextRepo.update).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    }
  );

  it('does not persist when preparation fails', async () => {
    const failure = new Error('Preparation failed');
    mockAccountingContextService.updateCurrentAccountingPeriod.mockRejectedValue(
      failure
    );
    await expect(execute(payload)).rejects.toBe(failure);
    expect(mockAccountingContextRepo.update).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('propagates persistence failures', async () => {
    const failure = new Error('Update failed');
    mockAccountingContextRepo.update.mockRejectedValue(failure);
    await expect(execute(payload)).rejects.toBe(failure);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });
  it('skips persistence, history and event publication for a no-op', async () => {
    mockAccountingContextService.updateCurrentAccountingPeriod.mockResolvedValue(
      [context, [], null]
    );
    await execute(payload);
    expect(mockAccountingContextRepo.update).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('publishes only after the context and history write finishes', async () => {
    let finish!: () => void;
    mockAccountingContextRepo.update.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      })
    );
    const running = execute(payload);
    await Promise.resolve();
    expect(mockAccountingContextRepo.update).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    finish();
    await running;
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
  });
});
