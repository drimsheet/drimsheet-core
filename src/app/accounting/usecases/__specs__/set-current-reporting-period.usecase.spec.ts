import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import generateUUID from '@shared/utils/uuid-generator';
import appError from '@shared/values/errors/app.error';
import historyValue from '@shared/values/history/history.vo';

import reportingContextEntity from '@domain/accounting/entities/reporting-context.entity';
import actorEntity from '@domain/user/entities/actor.entity';

import { mockReportingContextService } from '@app/accounting/contracts/__mocks__/accounting.domain.services.mock';
import { mockReportingContextRepo } from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import { INextCurrentReportingPeriodDto } from '@app/accounting/dtos/current-reporting-period/current-reporting-period.dto';
import makeSetCurrentReportingPeriodUsecase from '@app/accounting/usecases/set-current-reporting-period.usecase';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';

describe('setCurrentReportingPeriodUsecase', () => {
  const actor = actorEntity.makeSystem(actorEntity.makeMigration()[0].id)[0];
  const [previousContext] = reportingContextEntity.make({
    createdBy: generateUUID(),
    accountingEntityId: generateUUID(),
    accountingContextId: generateUUID(),
    reportingCurrencyCode: 'USD',
    currentReportingPeriodId: generateUUID(),
    accountingStandardCode: 'IFRS',
    name: 'Working context',
    description: null,
  });
  const transition = reportingContextEntity.update(previousContext, {
    currentReportingPeriodId: generateUUID(),
  });
  const [context, events, audit] = transition;
  const payload: INextCurrentReportingPeriodDto = {
    reportingContextId: context.id,
    accountingEntityId: context.accountingEntityId,
    fiscalYearId: generateUUID(),
    currentPeriodId: previousContext.currentReportingPeriodId,
    nextPeriodId: context.currentReportingPeriodId,
  };
  const correlationId = 'set-current-period';
  const execute = makeSetCurrentReportingPeriodUsecase({
    appContext: mockAppContext,
    reportingContextService: mockReportingContextService,
    reportingContextRepo: mockReportingContextRepo,
    eventBus: mockEventBus,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      actor,
      correlationId,
      idempotencyKey: '',
    });
    mockReportingContextService.updateCurrentReportingPeriod.mockResolvedValue(
      transition
    );
    mockReportingContextRepo.update.mockResolvedValue(undefined);
  });

  it('prepares the requested transition and persists the service result', async () => {
    await expect(execute(payload)).resolves.toBeUndefined();
    const previousState = {
      currentReportingPeriod: payload.currentPeriodId,
      nextReportingPeriod: payload.nextPeriodId,
    };
    expect(mockAppContext.get).toHaveBeenCalledWith(['actor']);
    expect(
      mockReportingContextService.updateCurrentReportingPeriod
    ).toHaveBeenCalledWith(
      { reportingContextId: payload.reportingContextId, previousState },
      { correlationId }
    );
    expect(mockReportingContextRepo.update).toHaveBeenCalledWith(context, {
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
    'reportingContextId',
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
        mockReportingContextService.updateCurrentReportingPeriod
      ).not.toHaveBeenCalled();
      expect(mockReportingContextRepo.update).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    }
  );

  it('does not persist when preparation fails', async () => {
    const failure = new Error('Preparation failed');
    mockReportingContextService.updateCurrentReportingPeriod.mockRejectedValue(
      failure
    );
    await expect(execute(payload)).rejects.toBe(failure);
    expect(mockReportingContextRepo.update).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('propagates persistence failures', async () => {
    const failure = new Error('Update failed');
    mockReportingContextRepo.update.mockRejectedValue(failure);
    await expect(execute(payload)).rejects.toBe(failure);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });
  it('skips persistence, history and event publication for a no-op', async () => {
    mockReportingContextService.updateCurrentReportingPeriod.mockResolvedValue([
      context,
      [],
      null,
    ]);
    await execute(payload);
    expect(mockReportingContextRepo.update).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('publishes only after the context and history write finishes', async () => {
    let finish!: () => void;
    mockReportingContextRepo.update.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      })
    );
    const running = execute(payload);
    await Promise.resolve();
    expect(mockReportingContextRepo.update).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    finish();
    await running;
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
  });
});
