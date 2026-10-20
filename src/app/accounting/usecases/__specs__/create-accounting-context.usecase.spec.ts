import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import generateUUID from '@shared/utils/uuid-generator';
import appError from '@shared/values/errors/app.error';

import accountingContextEntity from '@domain/accounting/entities/accounting-context.entity';
import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import accountingPeriodEntity from '@domain/accounting/entities/accounting-period.entity';
import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';
import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';
import accountingStandardError from '@domain/accounting/errors/accounting-standard.error';
import accountingError from '@domain/accounting/errors/accounting.error';
import actorEntity from '@domain/user/entities/actor.entity';

import { mockAccountingContextService } from '@app/accounting/contracts/__mocks__/accounting.domain.services.mock';
import {
  mockAccountingContextRepo,
  mockAccountingEntityRepo,
  mockAccountingPeriodRepo,
  mockFiscalYearRepo,
  mockReportingContextRepo,
  mockReportingPeriodRepo,
} from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import { IAccountingContextCreationReq } from '@app/accounting/dtos/accounting-context/accounting-context.dto';
import accountingAppError from '@app/accounting/errors/accounting.error';
import makeCreateAccountingContextUsecase from '@app/accounting/usecases/create-accounting-context.usecase';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';

describe('makeCreateAccountingContextUsecase', () => {
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
  const periods = accountingPeriodEntity
    .make({
      accountingEntityId: entity.id,
      createdBy: actor.id,
      fiscalYear: year,
      unit: 'month',
      count: 12,
    })
    .map(([period]) => period);
  const period = periods[3];
  const payload: IAccountingContextCreationReq = {
    fiscalYearId: year.id,
    currentAccountingPeriodId: period.id,
    accountingStandardCode: 'IFRS',
    name: 'Working context',
    description: null,
  };
  const creation = accountingContextEntity.make({
    ...payload,
    accountingEntityId: entity.id,
    fiscalYearId: year.id,
    currentAccountingPeriodId: period.id,
    previousAccountingPeriodId: periods[2].id,
    nextAccountingPeriodId: periods[4].id,
    createdBy: actor.id,
  });
  const correlationId = 'create-accounting-context';
  const execute = makeCreateAccountingContextUsecase({
    appContext: mockAppContext,
    accountingContextService: mockAccountingContextService,
    fiscalYearRepo: mockFiscalYearRepo,
    accountingPeriodRepo: mockAccountingPeriodRepo,
    accountingContextRepo: mockAccountingContextRepo,
    eventBus: mockEventBus,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      actor,
      accountingEntity: entity,
      correlationId,
    } as ReturnType<typeof mockAppContext.get>);
    mockFiscalYearRepo.findById.mockResolvedValue(year);
    mockAccountingPeriodRepo.findById.mockResolvedValue(period);
    mockAccountingContextService.create.mockResolvedValue(creation);
    mockAccountingContextRepo.create.mockResolvedValue(undefined);
  });

  it('uses the required entity from app context and saves only the context and its history', async () => {
    const result = await execute(payload);
    expect(mockAppContext.get).toHaveBeenCalledWith([
      'accountingEntity',
      'actor',
    ]);
    expect(mockAccountingEntityRepo.findById).not.toHaveBeenCalled();
    expect(mockFiscalYearRepo.findById).toHaveBeenCalledWith(year.id, {
      correlationId,
    });
    expect(mockAccountingPeriodRepo.findById).toHaveBeenCalledWith(period.id, {
      correlationId,
    });
    expect(mockAccountingContextService.create).toHaveBeenCalledWith(
      {
        accountingEntity: entity,
        fiscalYear: year,
        accountingPeriod: period,
        accountingStandardCode: payload.accountingStandardCode,
        name: payload.name,
        description: payload.description,
        createdBy: actor.id,
      },
      { correlationId }
    );
    expect(result).toEqual({
      ...payload,
      previousAccountingPeriodId: periods[2].id,
      nextAccountingPeriodId: periods[4].id,
      accountingEntityId: entity.id,
      id: expect.any(String),
      createdBy: actor.id,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
      closedAt: null,
    });
    const [saved, options] = mockAccountingContextRepo.create.mock.calls[0];
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
      mockReportingContextRepo,
    ]) {
      expect(repo.create).not.toHaveBeenCalled();
    }
    expect(mockAppContext.set).not.toHaveBeenCalled();
  });

  it('rejects a missing fiscal year', async () => {
    mockFiscalYearRepo.findById.mockResolvedValue(null);
    await expect(execute(payload)).rejects.toBeInstanceOf(
      accountingAppError.FiscalYearNotFound
    );
    expect(mockAccountingPeriodRepo.findById).not.toHaveBeenCalled();
    expect(mockAccountingContextService.create).not.toHaveBeenCalled();
    expect(mockAccountingContextRepo.create).not.toHaveBeenCalled();
  });

  it('rejects a missing selected period', async () => {
    mockAccountingPeriodRepo.findById.mockResolvedValue(null);
    await expect(execute(payload)).rejects.toBeInstanceOf(
      accountingAppError.AccountingPeriodNotFound
    );
    expect(mockAccountingContextService.create).not.toHaveBeenCalled();
    expect(mockAccountingContextRepo.create).not.toHaveBeenCalled();
  });

  it.each([
    accountingEntityError.Archived,
    accountingError.InvalidFiscalYearId,
    accountingError.InvalidCurrentAccountingPeriodId,
    accountingStandardError.Invalid,
  ])(
    'propagates domain creation rejection without persisting or publishing',
    async (ErrorType) => {
      const error = new ErrorType();
      mockAccountingContextService.create.mockRejectedValue(error);
      await expect(execute(payload)).rejects.toBe(error);
      expect(mockAccountingContextService.create).toHaveBeenCalledTimes(1);
      expect(mockAccountingContextRepo.create).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    }
  );

  it.each([
    { accountingEntityId: entity.id },
    { fiscalYearId: 'invalid' },
    { currentAccountingPeriodId: undefined },
    { currentAccountingPeriodId: 'invalid' },
    { accountingStandardCode: 'UNKNOWN' },
    { name: null },
    { description: 4 },
    { createdBy: userId },
  ])('rejects malformed input before reads: %j', async (change) => {
    await expect(
      execute({ ...payload, ...change } as IAccountingContextCreationReq)
    ).rejects.toBeInstanceOf(appError.UnprocessableEntity);
    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockAccountingContextService.create).not.toHaveBeenCalled();
    expect(mockAccountingContextRepo.create).not.toHaveBeenCalled();
  });

  it.each(['history failed', 'commit failed'])(
    'does not publish when repository creation fails: %s',
    async (message) => {
      const failure = new Error(message);
      mockAccountingContextRepo.create.mockRejectedValue(failure);
      await expect(execute(payload)).rejects.toBe(failure);
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    }
  );

  it('waits for the service to resolve the period references before persisting', async () => {
    let finishCreation!: () => void;
    mockAccountingContextService.create.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishCreation = () => resolve(creation);
        })
    );

    const pending = execute(payload);
    await new Promise(process.nextTick);
    expect(mockAccountingContextRepo.create).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();

    finishCreation();
    await pending;
    expect(mockAccountingContextRepo.create).toHaveBeenCalledWith(
      creation[0],
      expect.objectContaining({ correlationId })
    );
  });

  it('waits for repository creation to resolve before publishing', async () => {
    let commit!: () => void;
    mockAccountingContextRepo.create.mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        commit = resolve;
      });
    });
    const pending = execute(payload);
    await new Promise(process.nextTick);
    expect(mockAccountingContextRepo.create).toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    commit();
    await pending;
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
  });
});
