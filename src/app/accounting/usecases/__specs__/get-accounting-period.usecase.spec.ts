import { TEntityId } from '@shared/types/uuid';

import { IAccountingPeriod } from '@domain/accounting/types/period.types';

import { mockAccountingPeriodRepo } from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import accountingAppError from '@app/accounting/errors/accounting.error';
import makeGetAccountingPeriodUsecase from '@app/accounting/usecases/get-accounting-period.usecase';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';

const entityId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const period: IAccountingPeriod = {
  id: '123e4567-e89b-12d3-a456-426614174002' as TEntityId,
  createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
  name: 'January 2026',
  fiscalYearId: '123e4567-e89b-12d3-a456-426614174004' as TEntityId,
  unit: 'month',
  count: 12,
  accountingEntityId: entityId,
  startDate: new Date('2026-01-01'),
  endDate: new Date('2026-01-31'),
  status: 'open',
  closedAt: null,
  updatedAt: new Date('2026-01-01'),
};

describe('getAccountingPeriodUsecase', () => {
  const execute = makeGetAccountingPeriodUsecase({
    appContext: mockAppContext,
    accountingPeriodRepo: mockAccountingPeriodRepo,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      correlationId: 'accounting-period-read',
      accountingEntity: { id: entityId },
    });
  });

  it('looks up the accounting period within the entity from request context', async () => {
    mockAccountingPeriodRepo.findById.mockResolvedValue(period);
    await expect(execute(period.id)).resolves.toEqual(period);
    expect(mockAppContext.get).toHaveBeenCalledWith(['accountingEntity']);
    expect(mockAccountingPeriodRepo.findById).toHaveBeenCalledWith(
      entityId,
      period.id,
      {
        correlationId: 'accounting-period-read',
      }
    );
    expect(mockAccountingPeriodRepo.create).not.toHaveBeenCalled();
    expect(mockAppContext.set).not.toHaveBeenCalled();
  });

  it('rejects a missing accounting period', async () => {
    mockAccountingPeriodRepo.findById.mockResolvedValue(null);
    await expect(execute(period.id)).rejects.toBeInstanceOf(
      accountingAppError.AccountingPeriodNotFound
    );
  });

  it('does not expose an accounting period belonging to another entity', async () => {
    const otherEntityId = '123e4567-e89b-12d3-a456-426614174099' as TEntityId;
    mockAccountingPeriodRepo.findById.mockImplementation(
      async (accountingEntityId, id) =>
        id === period.id && accountingEntityId === period.accountingEntityId
          ? period
          : null
    );
    mockAppContext.get.mockReturnValue({
      correlationId: 'accounting-period-read',
      accountingEntity: { id: otherEntityId },
    });
    await expect(execute(period.id)).rejects.toBeInstanceOf(
      accountingAppError.AccountingPeriodNotFound
    );
    expect(mockAccountingPeriodRepo.findById).toHaveBeenCalledWith(
      otherEntityId,
      period.id,
      {
        correlationId: 'accounting-period-read',
      }
    );
  });

  it.each(['', 'not-a-uuid'])(
    'rejects an invalid ID before reading: %j',
    async (id) => {
      await expect(execute(id)).rejects.toMatchObject({
        errorKey: 'app_error_validation_error',
      });
      expect(mockAppContext.get).not.toHaveBeenCalled();
      expect(mockAccountingPeriodRepo.findById).not.toHaveBeenCalled();
    }
  );

  it('propagates repository failures', async () => {
    const failure = new Error('read failed');
    mockAccountingPeriodRepo.findById.mockRejectedValue(failure);
    await expect(execute(period.id)).rejects.toBe(failure);
  });

  it('does not query without required entity context', async () => {
    const failure = new Error('context unavailable');
    mockAppContext.get.mockImplementation(() => {
      throw failure;
    });
    await expect(execute(period.id)).rejects.toBe(failure);
    expect(mockAccountingPeriodRepo.findById).not.toHaveBeenCalled();
  });
});
