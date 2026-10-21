import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import generateUUID from '@shared/utils/uuid-generator';
import appError from '@shared/values/errors/app.error';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';
import periodError from '@domain/accounting/errors/period.error';
import actorEntity from '@domain/user/entities/actor.entity';
import { IUser } from '@domain/user/types/user.types';

import { mockFiscalYearService } from '@app/accounting/contracts/__mocks__/accounting.domain.services.mock';
import {
  mockAccountingContextRepo,
  mockAccountingEntityRepo,
  mockAccountingPeriodRepo,
  mockFiscalYearRepo,
  mockReportingContextRepo,
  mockReportingPeriodRepo,
} from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import { IFiscalYearCreationReq } from '@app/accounting/dtos/fiscal-year/fiscal-year.dto';
import accountingAppError from '@app/accounting/errors/accounting.error';
import makeCreateFiscalYearUsecase from '@app/accounting/usecases/create-fiscal-year.usecase';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';

describe('makeCreateFiscalYearUsecase', () => {
  const actor = actorEntity.makeUser({
    email: 'owner@example.com',
    displayName: 'Owner',
  })[0];
  const userId = generateUUID();
  const entity = accountingEntityEntity.make({
    createdBy: actor.id,
    ownerId: userId,
    name: 'Business',
    type: 'sole_trader',
    functionalCurrencyCode: 'NGN',
    jurisdictionCode: 'NG',
  })[0];
  const payload: IFiscalYearCreationReq = {
    accountingEntityId: entity.id,
    name: 'FY',
    startDate: new Date('2090-01-01'),
    endDate: new Date('2090-12-31'),
    status: 'open',
  };
  const creation = fiscalYearEntity.make({
    ...payload,
    accountingEntityId: entity.id,
    createdBy: actor.id,
  });
  const [year] = creation;

  const correlationId = 'create-fiscal-year';
  const execute = makeCreateFiscalYearUsecase({
    appContext: mockAppContext,
    fiscalYearRepo: mockFiscalYearRepo,
    fiscalYearService: mockFiscalYearService,
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
    mockFiscalYearService.create.mockResolvedValue(creation);
  });

  it('uses the context entity to create only its fiscal year and history', async () => {
    const result = await execute(payload);
    expect(result).toBe(year);
    expect(mockAppContext.get).toHaveBeenCalledWith([
      'actor',
      'accountingEntity',
    ]);
    expect(mockAccountingEntityRepo.findById).not.toHaveBeenCalled();
    expect(mockFiscalYearService.create).toHaveBeenCalledWith(
      {
        accountingEntity: entity,
        createdBy: actor.id,
        name: payload.name,
        startDate: payload.startDate,
        endDate: payload.endDate,
        status: payload.status,
      },
      { correlationId }
    );
    expect(mockFiscalYearRepo.create).toHaveBeenCalledWith(year, {
      correlationId,
      history: expect.objectContaining({
        actorId: actor.id,
        correlationId,
        diff: expect.objectContaining({
          after: JSON.parse(JSON.stringify(year)) as unknown,
        }),
      }),
    });
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      creation[1].map((event) =>
        expect.objectContaining({ type: event.type, data: year, correlationId })
      )
    );
    for (const repo of [
      mockAccountingEntityRepo,
      mockAccountingPeriodRepo,
      mockReportingPeriodRepo,
      mockAccountingContextRepo,
      mockReportingContextRepo,
    ]) {
      expect(repo.create).not.toHaveBeenCalled();
    }
    expect(mockAppContext.set).not.toHaveBeenCalled();
  });

  it('rejects a missing entity before domain creation', async () => {
    mockAppContext.get.mockReturnValue({
      actor,
      correlationId,
    } as ReturnType<typeof mockAppContext.get>);
    await expect(execute(payload)).rejects.toBeInstanceOf(
      accountingAppError.EntityNotFound
    );
    expect(mockFiscalYearService.create).not.toHaveBeenCalled();
    expect(mockFiscalYearRepo.create).not.toHaveBeenCalled();
  });

  it('propagates context rejection before domain creation', async () => {
    const failure = new appError.Unauthorized();
    mockAppContext.get.mockImplementation(() => {
      throw failure;
    });
    await expect(execute(payload)).rejects.toBe(failure);
    expect(mockFiscalYearService.create).not.toHaveBeenCalled();
    expect(mockFiscalYearRepo.create).not.toHaveBeenCalled();
  });

  it.each([
    periodError.InvalidDateRange,
    periodError.FiscalYearExceedsJurisdictionLimit,
    periodError.OverlappingFiscalYears,
  ])('propagates domain rejection without persistence', async (ErrorType) => {
    const error = new ErrorType();
    mockFiscalYearService.create.mockRejectedValue(error);
    await expect(execute(payload)).rejects.toBe(error);
    expect(mockFiscalYearRepo.create).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it.each([
    { accountingEntityId: 'invalid' },
    { startDate: '2090-01-01' },
    { endDate: new Date('invalid') },
    { status: 'invalid' },
    { createdBy: userId },
  ])('rejects malformed input before reads: %j', async (change) => {
    await expect(
      execute({ ...payload, ...change } as IFiscalYearCreationReq)
    ).rejects.toBeInstanceOf(appError.UnprocessableEntity);
    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockAccountingEntityRepo.findById).not.toHaveBeenCalled();
  });

  it.each([new Error('history failed'), new Error('commit failed')])(
    'propagates persistence failure without publishing',
    async (failure) => {
      mockFiscalYearRepo.create.mockRejectedValueOnce(failure);
      await expect(execute(payload)).rejects.toBe(failure);
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    }
  );

  it('waits for persistence to complete before publishing', async () => {
    let finishPersistence!: () => void;
    mockFiscalYearRepo.create.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishPersistence = resolve;
        })
    );
    const pending = execute(payload);
    await new Promise(process.nextTick);
    expect(mockFiscalYearRepo.create).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    finishPersistence();
    await expect(pending).resolves.toBe(year);
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
  });
});
