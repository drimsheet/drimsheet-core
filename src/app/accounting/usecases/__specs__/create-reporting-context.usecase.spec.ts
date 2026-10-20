import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import generateUUID from '@shared/utils/uuid-generator';
import appError from '@shared/values/errors/app.error';

import accountingContextEntity from '@domain/accounting/entities/accounting-context.entity';
import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';
import reportingContextEntity from '@domain/accounting/entities/reporting-context.entity';
import reportingPeriodEntity from '@domain/accounting/entities/reporting-period.entity';
import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';
import accountingStandardError from '@domain/accounting/errors/accounting-standard.error';
import accountingError from '@domain/accounting/errors/accounting.error';
import actorEntity from '@domain/user/entities/actor.entity';

import { mockReportingContextService } from '@app/accounting/contracts/__mocks__/accounting.domain.services.mock';
import {
  mockAccountingContextRepo,
  mockAccountingEntityRepo,
  mockAccountingPeriodRepo,
  mockFiscalYearRepo,
  mockReportingContextRepo,
  mockReportingPeriodRepo,
} from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import { IReportingContextCreationReq } from '@app/accounting/dtos/reporting-context/reporting-context.dto';
import accountingAppError from '@app/accounting/errors/accounting.error';
import makeCreateReportingContextUsecase from '@app/accounting/usecases/create-reporting-context.usecase';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';

describe('makeCreateReportingContextUsecase', () => {
  const actor = actorEntity.makeUser({
    email: 'owner@example.com',
    displayName: 'Owner',
  })[0];
  const userId = generateUUID();
  const entity = accountingEntityEntity.make({
    createdBy: actor.id,
    ownerId: userId,
    name: 'Business',
    type: 'private_company',
    functionalCurrencyCode: 'NGN',
    jurisdictionCode: 'NG',
  })[0];
  const year = fiscalYearEntity.make({
    accountingEntityId: entity.id,
    createdBy: actor.id,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    status: 'open',
  })[0];
  const period = reportingPeriodEntity.make({
    accountingEntityId: entity.id,
    createdBy: actor.id,
    fiscalYear: year,
    unit: 'month',
    count: 12,
  })[3][0];
  const sourceContext = accountingContextEntity.make({
    accountingEntityId: entity.id,
    fiscalYearId: year.id,
    currentAccountingPeriodId: generateUUID(),
    previousAccountingPeriodId: null,
    nextAccountingPeriodId: null,
    accountingStandardCode: 'IFRS',
    createdBy: actor.id,
    name: 'Accounting context',
    description: null,
  })[0];
  const payload: IReportingContextCreationReq = {
    accountingContextId: sourceContext.id,
    currentReportingPeriodId: period.id,
    accountingStandardCode: 'IFRS',
    reportingCurrencyCode: 'USD',
    name: 'Working context',
    description: null,
  };
  const creation = reportingContextEntity.make({
    ...payload,
    accountingEntityId: entity.id,
    accountingContextId: sourceContext.id,
    currentReportingPeriodId: period.id,
    createdBy: actor.id,
  });
  const correlationId = 'create-reporting-context';
  const execute = makeCreateReportingContextUsecase({
    appContext: mockAppContext,
    reportingContextService: mockReportingContextService,
    accountingContextRepo: mockAccountingContextRepo,
    reportingPeriodRepo: mockReportingPeriodRepo,
    reportingContextRepo: mockReportingContextRepo,
    eventBus: mockEventBus,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      actor,
      accountingEntity: entity,
      correlationId,
    } as ReturnType<typeof mockAppContext.get>);
    mockAccountingContextRepo.findById.mockResolvedValue(sourceContext);
    mockReportingPeriodRepo.findById.mockResolvedValue(period);
    mockReportingContextService.create.mockReturnValue(creation);
    mockReportingContextRepo.create.mockResolvedValue(undefined);
  });

  it('uses the required entity from app context and saves only the context and its history', async () => {
    const result = await execute(payload);
    expect(mockAppContext.get).toHaveBeenCalledWith([
      'accountingEntity',
      'actor',
    ]);
    expect(mockAccountingEntityRepo.findById).not.toHaveBeenCalled();
    expect(mockAccountingContextRepo.findById).toHaveBeenCalledWith(
      sourceContext.id,
      {
        correlationId,
      }
    );
    expect(mockReportingPeriodRepo.findById).toHaveBeenCalledWith(period.id, {
      correlationId,
    });
    expect(mockReportingContextService.create).toHaveBeenCalledWith({
      accountingEntity: entity,
      accountingContext: sourceContext,
      reportingPeriod: period,
      accountingStandardCode: payload.accountingStandardCode,
      reportingCurrencyCode: payload.reportingCurrencyCode,
      name: payload.name,
      description: payload.description,
      createdBy: actor.id,
    });
    expect(result).toEqual({
      ...payload,
      accountingEntityId: entity.id,
      id: expect.any(String),
      createdBy: actor.id,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
      closedAt: null,
    });
    const [saved, options] = mockReportingContextRepo.create.mock.calls[0];
    expect(result).toEqual(saved);
    expect(result).not.toBe(saved);
    expect(options).toEqual({
      correlationId,
      history: expect.objectContaining({
        actorId: actor.id,
        correlationId,
        diff: expect.objectContaining({
          after: JSON.parse(JSON.stringify(saved)) as unknown,
        }),
      }),
    });
    expect(mockEventBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({ data: saved, correlationId }),
    ]);
    for (const repo of [
      mockAccountingEntityRepo,
      mockFiscalYearRepo,
      mockAccountingPeriodRepo,
      mockReportingPeriodRepo,
      mockAccountingContextRepo,
    ]) {
      expect(repo.create).not.toHaveBeenCalled();
    }
    expect(mockAppContext.set).not.toHaveBeenCalled();
  });

  it('rejects a missing accounting context', async () => {
    mockAccountingContextRepo.findById.mockResolvedValue(null);
    await expect(execute(payload)).rejects.toBeInstanceOf(
      accountingAppError.AccountingContextNotFound
    );
    expect(mockReportingPeriodRepo.findById).not.toHaveBeenCalled();
    expect(mockReportingContextService.create).not.toHaveBeenCalled();
    expect(mockReportingContextRepo.create).not.toHaveBeenCalled();
  });

  it('rejects a missing selected period', async () => {
    mockReportingPeriodRepo.findById.mockResolvedValue(null);
    await expect(execute(payload)).rejects.toBeInstanceOf(
      accountingAppError.ReportingPeriodNotFound
    );
    expect(mockReportingContextService.create).not.toHaveBeenCalled();
    expect(mockReportingContextRepo.create).not.toHaveBeenCalled();
  });

  it.each([
    accountingEntityError.Archived,
    accountingError.InvalidAccountingContextId,
    accountingError.InvalidCurrentReportingPeriodId,
    accountingStandardError.Invalid,
  ])(
    'propagates domain creation rejection without persisting or publishing',
    async (ErrorType) => {
      const error = new ErrorType();
      mockReportingContextService.create.mockImplementation(() => {
        throw error;
      });
      await expect(execute(payload)).rejects.toBe(error);
      expect(mockReportingContextService.create).toHaveBeenCalledTimes(1);
      expect(mockReportingContextRepo.create).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    }
  );

  it.each([
    { accountingEntityId: entity.id },
    { accountingContextId: 'invalid' },
    { accountingContextId: undefined },
    { fiscalYearId: year.id },
    { reportingCurrencyCode: 'INVALID' },
    { reportingCurrencyCode: undefined },
    { currentReportingPeriodId: undefined },
    { currentReportingPeriodId: 'invalid' },
    { accountingStandardCode: 'UNKNOWN' },
    { name: null },
    { description: 4 },
    { createdBy: userId },
  ])('rejects malformed input before reads: %j', async (change) => {
    await expect(
      execute({ ...payload, ...change } as IReportingContextCreationReq)
    ).rejects.toBeInstanceOf(appError.UnprocessableEntity);
    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockReportingContextService.create).not.toHaveBeenCalled();
    expect(mockReportingContextRepo.create).not.toHaveBeenCalled();
  });

  it.each(['history failed', 'commit failed'])(
    'does not publish when repository creation fails: %s',
    async (message) => {
      const failure = new Error(message);
      mockReportingContextRepo.create.mockRejectedValue(failure);
      await expect(execute(payload)).rejects.toBe(failure);
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    }
  );

  it('waits for repository creation to resolve before publishing', async () => {
    let commit!: () => void;
    mockReportingContextRepo.create.mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        commit = resolve;
      });
    });
    const pending = execute(payload);
    await new Promise(process.nextTick);
    expect(mockReportingContextRepo.create).toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    commit();
    await pending;
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
  });
});
