import { TEntityId } from '@shared/types/uuid';

import { IFiscalYear } from '@domain/accounting/types/fiscal-year.types';

import { mockFiscalYearRepo } from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import makeGetFiscalYearsUsecase from '@app/accounting/usecases/get-fiscal-years.usecase';
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

describe('getFiscalYearsUsecase', () => {
  const execute = makeGetFiscalYearsUsecase({
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

  it('returns all fiscal-year statuses for the entity in request context', async () => {
    const years: IFiscalYear[] = ['pending', 'open', 'closing', 'closed'].map(
      (status, index) => ({
        ...year,
        id: `123e4567-e89b-12d3-a456-42661417401${index}` as TEntityId,
        status: status as IFiscalYear['status'],
      })
    );
    mockFiscalYearRepo.findByAccountingEntityId.mockResolvedValue(years);

    await expect(execute()).resolves.toEqual(years);
    expect(mockAppContext.get).toHaveBeenCalledWith(['accountingEntity']);
    expect(mockFiscalYearRepo.findByAccountingEntityId).toHaveBeenCalledWith(
      entityId,
      { correlationId: 'fiscal-year-read' }
    );
    expect(mockFiscalYearRepo.create).not.toHaveBeenCalled();
    expect(mockAppContext.set).not.toHaveBeenCalled();
  });

  it('returns an empty array when the entity has no fiscal years', async () => {
    mockFiscalYearRepo.findByAccountingEntityId.mockResolvedValue([]);
    await expect(execute()).resolves.toEqual([]);
  });

  it('propagates repository failures', async () => {
    const failure = new Error('read failed');
    mockFiscalYearRepo.findByAccountingEntityId.mockRejectedValue(failure);
    await expect(execute()).rejects.toBe(failure);
  });

  it('does not query without required entity context', async () => {
    const failure = new Error('context unavailable');
    mockAppContext.get.mockImplementation(() => {
      throw failure;
    });
    await expect(execute()).rejects.toBe(failure);
    expect(mockFiscalYearRepo.findByAccountingEntityId).not.toHaveBeenCalled();
  });
});
