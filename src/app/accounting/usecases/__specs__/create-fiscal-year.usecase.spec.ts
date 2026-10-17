import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService from '@shared/contracts/__mocks__/repo.mock';
import { ITransactionContext } from '@shared/types/repo.types';
import generateUUID from '@shared/utils/uuid-generator';
import appError from '@shared/values/errors/app.error';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';
import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';
import periodError from '@domain/accounting/errors/period.error';
import actorEntity from '@domain/user/entities/actor.entity';
import { IUser } from '@domain/user/types/user.types';

import {
  mockAccountingEntityService,
  mockFiscalYearService,
} from '@app/accounting/contracts/__mocks__/accounting.domain.services.mock';
import {
  mockAccountingContextRepo,
  mockAccountingEntityRepo,
  mockAccountingPeriodRepo,
  mockFiscalYearRepo,
  mockReportingContextRepo,
  mockReportingPeriodRepo,
} from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import { IFiscalYearCreationReq } from '@app/accounting/dtos/fiscal-year/fiscal-year.dto';
import fiscalYearDtoMapper from '@app/accounting/dtos/fiscal-year/fiscal-year.dto.mapper';
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
  const tx: ITransactionContext = {};
  const correlationId = 'create-fiscal-year';
  const execute = makeCreateFiscalYearUsecase({
    appContext: mockAppContext,
    accountingEntityRepo: mockAccountingEntityRepo,
    accountingEntityService: mockAccountingEntityService,
    fiscalYearRepo: mockFiscalYearRepo,
    fiscalYearService: mockFiscalYearService,
    repoService: mockRepoService,
    eventBus: mockEventBus,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      actor,
      user: { id: userId } as IUser,
      correlationId,
    } as ReturnType<typeof mockAppContext.get>);
    mockAccountingEntityRepo.findById.mockResolvedValue(entity);
    mockFiscalYearService.create.mockResolvedValue(creation);
    mockRepoService.runInTransaction.mockImplementation(async (write) =>
      write(tx)
    );
  });

  it('resolves and authorizes the entity before creating only its year and history', async () => {
    const result = await execute(payload);
    expect(result).toEqual(fiscalYearDtoMapper.toDto(year));
    expect(result).not.toBe(year);
    expect(mockAccountingEntityRepo.findById).toHaveBeenCalledWith(entity.id, {
      correlationId,
    });
    expect(mockAccountingEntityService.validateAccess).toHaveBeenCalledWith(
      entity,
      userId
    );
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
      tx,
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
    mockAccountingEntityRepo.findById.mockResolvedValue(null);
    await expect(execute(payload)).rejects.toBeInstanceOf(
      accountingAppError.EntityNotFound
    );
    expect(mockAccountingEntityService.validateAccess).not.toHaveBeenCalled();
    expect(mockFiscalYearService.create).not.toHaveBeenCalled();
    expect(mockFiscalYearRepo.create).not.toHaveBeenCalled();
  });

  it('rejects an inaccessible entity before domain creation', async () => {
    mockAccountingEntityService.validateAccess.mockImplementation(() => {
      throw new accountingEntityError.Unauthorized();
    });
    await expect(execute(payload)).rejects.toBeInstanceOf(
      accountingEntityError.Unauthorized
    );
    expect(mockFiscalYearService.create).not.toHaveBeenCalled();
    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
  });

  it.each([
    periodError.InvalidDateRange,
    periodError.FiscalYearExceedsJurisdictionLimit,
    periodError.OverlappingFiscalYears,
  ])('propagates domain rejection without persistence', async (ErrorType) => {
    const error = new ErrorType();
    mockFiscalYearService.create.mockRejectedValue(error);
    await expect(execute(payload)).rejects.toBe(error);
    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
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

  it('rolls back the owning transaction on persistence failure without publishing', async () => {
    const failure = new Error('history failed');
    let rolledBack = false;
    mockFiscalYearRepo.create.mockRejectedValue(failure);
    mockRepoService.runInTransaction.mockImplementation(async (write) => {
      try {
        return await write(tx);
      } catch (error) {
        rolledBack = true;
        throw error;
      }
    });
    await expect(execute(payload)).rejects.toBe(failure);
    expect(rolledBack).toBe(true);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('does not publish if commit fails', async () => {
    const failure = new Error('commit failed');
    mockRepoService.runInTransaction.mockImplementation(async (write) => {
      await write(tx);
      throw failure;
    });
    await expect(execute(payload)).rejects.toBe(failure);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('waits until the owning transaction commits before publication', async () => {
    let commit!: () => void;
    mockRepoService.runInTransaction.mockImplementation(async (write) => {
      await write(tx);
      await new Promise<void>((resolve) => {
        commit = resolve;
      });
    });
    const pending = execute(payload);
    await new Promise(process.nextTick);
    expect(mockFiscalYearRepo.create).toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    commit();
    await pending;
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
  });
});
