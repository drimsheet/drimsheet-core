import { TEntityId } from '@shared/types/uuid';

import mockAccountingContextQueryRepo from '@app/accounting/contracts/__mocks__/accounting-context.query.repo.mock';
import { IAccountingContextDetails } from '@app/accounting/contracts/accounting-context.query.repo.contract';
import makeGetAccountingContextsUsecase from '@app/accounting/usecases/get-accounting-contexts.usecase';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';

const entityId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const actorId = 'a1111111-1111-4111-8111-111111111111' as TEntityId;
const fiscalYearId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
const periodId = '123e4567-e89b-12d3-a456-426614174003' as TEntityId;
const timestamp = new Date('2026-01-01T00:00:00.000Z');
const context: IAccountingContextDetails = {
  id: '123e4567-e89b-12d3-a456-426614174004' as TEntityId,
  createdBy: actorId,
  name: 'Default Accounting Context',
  description: null,
  accountingEntityId: entityId,
  accountingStandardCode: 'IFRS',
  fiscalYearId,
  currentAccountingPeriodId: periodId,
  previousAccountingPeriodId: null,
  nextAccountingPeriodId: null,
  createdAt: timestamp,
  updatedAt: timestamp,
  closedAt: null,
  fiscalYear: {
    id: fiscalYearId,
    createdBy: actorId,
    name: '2026',
    accountingEntityId: entityId,
    startDate: timestamp,
    endDate: new Date('2026-12-31T00:00:00.000Z'),
    status: 'open',
    closedAt: null,
    updatedAt: timestamp,
  },
  accountingPeriods: [
    {
      id: periodId,
      createdBy: actorId,
      name: 'January',
      accountingEntityId: entityId,
      fiscalYearId,
      unit: 'month',
      count: 12,
      startDate: timestamp,
      endDate: new Date('2026-01-31T00:00:00.000Z'),
      status: 'closed',
      closedAt: new Date('2026-02-01T00:00:00.000Z'),
      updatedAt: timestamp,
    },
  ],
};

describe('getAccountingContextsUsecase', () => {
  const execute = makeGetAccountingContextsUsecase({
    appContext: mockAppContext,
    accountingContextQueryRepo: mockAccountingContextQueryRepo,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      correlationId: 'contexts-read',
      accountingEntity: { id: entityId },
    });
  });

  it('returns every active context for the entity from request context', async () => {
    const secondContext = {
      ...context,
      id: '123e4567-e89b-12d3-a456-426614174005' as TEntityId,
      name: 'Second context',
    };
    mockAccountingContextQueryRepo.findActiveByAccountingEntityId.mockResolvedValue(
      [context, secondContext]
    );
    await expect(execute()).resolves.toEqual([context, secondContext]);
    expect(mockAppContext.get).toHaveBeenCalledWith(['accountingEntity']);
    expect(
      mockAccountingContextQueryRepo.findActiveByAccountingEntityId
    ).toHaveBeenCalledWith(entityId, { correlationId: 'contexts-read' });
    expect(mockAppContext.set).not.toHaveBeenCalled();
  });

  it('returns an empty list when no active contexts exist', async () => {
    mockAccountingContextQueryRepo.findActiveByAccountingEntityId.mockResolvedValue(
      []
    );
    await expect(execute()).resolves.toEqual([]);
  });

  it('propagates read failures', async () => {
    const error = new Error('read failed');
    mockAccountingContextQueryRepo.findActiveByAccountingEntityId.mockRejectedValue(
      error
    );
    await expect(execute()).rejects.toBe(error);
  });

  it('does not query without required entity context', async () => {
    const error = new Error('context unavailable');
    mockAppContext.get.mockImplementation(() => {
      throw error;
    });
    await expect(execute()).rejects.toBe(error);
    expect(
      mockAccountingContextQueryRepo.findActiveByAccountingEntityId
    ).not.toHaveBeenCalled();
  });
});
