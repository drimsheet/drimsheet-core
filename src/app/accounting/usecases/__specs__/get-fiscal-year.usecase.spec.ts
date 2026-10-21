import { TEntityId } from '@shared/types/uuid';

import { IFiscalYear } from '@domain/accounting/types/fiscal-year.types';

import { mockFiscalYearRepo } from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import accountingAppError from '@app/accounting/errors/accounting.error';
import makeGetFiscalYearUsecase from '@app/accounting/usecases/get-fiscal-year.usecase';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';

const entityId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const year: IFiscalYear = {
  id: '123e4567-e89b-12d3-a456-426614174002' as TEntityId,
  createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
  name: '2026',
  accountingEntityId: entityId,
  startDate: new Date('2026-01-01'),
  endDate: new Date('2026-12-31'),
  status: 'open',
  closedAt: null,
  updatedAt: new Date('2026-01-01'),
};

describe('getFiscalYearUsecase', () => {
  const execute = makeGetFiscalYearUsecase({
    appContext: mockAppContext,
    fiscalYearRepo: mockFiscalYearRepo,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      correlationId: 'fiscal-year-read',
      accountingEntity: { id: entityId },
    });
  });

  it('looks up the fiscal year within the entity from request context', async () => {
    mockFiscalYearRepo.findByIdAndAccountingEntityId.mockResolvedValue(year);
    await expect(execute(year.id)).resolves.toEqual(year);
    expect(mockAppContext.get).toHaveBeenCalledWith(['accountingEntity']);
    expect(
      mockFiscalYearRepo.findByIdAndAccountingEntityId
    ).toHaveBeenCalledWith(year.id, entityId, {
      correlationId: 'fiscal-year-read',
    });
    expect(mockFiscalYearRepo.findById).not.toHaveBeenCalled();
    expect(mockFiscalYearRepo.create).not.toHaveBeenCalled();
    expect(mockAppContext.set).not.toHaveBeenCalled();
  });

  it('rejects a missing fiscal year', async () => {
    mockFiscalYearRepo.findByIdAndAccountingEntityId.mockResolvedValue(null);
    await expect(execute(year.id)).rejects.toBeInstanceOf(
      accountingAppError.FiscalYearNotFound
    );
  });

  it('does not expose a fiscal year belonging to another entity', async () => {
    const otherEntityId = '123e4567-e89b-12d3-a456-426614174099' as TEntityId;
    mockFiscalYearRepo.findByIdAndAccountingEntityId.mockImplementation(
      async (id, accountingEntityId) =>
        id === year.id && accountingEntityId === year.accountingEntityId
          ? year
          : null
    );
    mockAppContext.get.mockReturnValue({
      correlationId: 'fiscal-year-read',
      accountingEntity: { id: otherEntityId },
    });
    await expect(execute(year.id)).rejects.toBeInstanceOf(
      accountingAppError.FiscalYearNotFound
    );
    expect(
      mockFiscalYearRepo.findByIdAndAccountingEntityId
    ).toHaveBeenCalledWith(year.id, otherEntityId, {
      correlationId: 'fiscal-year-read',
    });
  });

  it.each(['', 'not-a-uuid'])(
    'rejects an invalid ID before reading: %j',
    async (id) => {
      await expect(execute(id)).rejects.toMatchObject({
        errorKey: 'app_error_validation_error',
      });
      expect(mockAppContext.get).not.toHaveBeenCalled();
      expect(
        mockFiscalYearRepo.findByIdAndAccountingEntityId
      ).not.toHaveBeenCalled();
    }
  );

  it('propagates repository failures', async () => {
    const failure = new Error('read failed');
    mockFiscalYearRepo.findByIdAndAccountingEntityId.mockRejectedValue(failure);
    await expect(execute(year.id)).rejects.toBe(failure);
  });

  it('does not query without required entity context', async () => {
    const failure = new Error('context unavailable');
    mockAppContext.get.mockImplementation(() => {
      throw failure;
    });
    await expect(execute(year.id)).rejects.toBe(failure);
    expect(
      mockFiscalYearRepo.findByIdAndAccountingEntityId
    ).not.toHaveBeenCalled();
  });
});
