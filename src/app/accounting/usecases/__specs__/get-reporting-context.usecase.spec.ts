import { TEntityId } from '@shared/types/uuid';

import { IReportingContext } from '@domain/accounting/types/context.types';
import { IFiscalYear } from '@domain/accounting/types/fiscal-year.types';

import {
  mockFiscalYearRepo,
  mockReportingContextRepo,
} from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import accountingAppError from '@app/accounting/errors/accounting.error';
import makeGetReportingContextUsecase from '@app/accounting/usecases/get-reporting-context.usecase';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';

const entityId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const actorId = 'a1111111-1111-4111-8111-111111111111' as TEntityId;
const fiscalYearId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
const intervalId = '123e4567-e89b-12d3-a456-426614174003' as TEntityId;
const timestamp = new Date('2026-01-01T00:00:00.000Z');
const context: IReportingContext = {
  id: '123e4567-e89b-12d3-a456-426614174004' as TEntityId,
  createdBy: actorId,
  name: 'Default Accounting Context',
  description: null,
  accountingEntityId: entityId,
  accountingContextId: '123e4567-e89b-12d3-a456-426614174005' as TEntityId,
  reportingCurrencyCode: 'USD',
  reportingIntervalId: intervalId,
  createdAt: timestamp,
  updatedAt: timestamp,
  closedAt: null,
};
const fiscalYear: IFiscalYear = {
  id: fiscalYearId,
  createdBy: actorId,
  name: '2026',
  accountingEntityId: entityId,
  startDate: timestamp,
  endDate: new Date('2026-12-31T00:00:00.000Z'),
  status: 'open',
  closedAt: null,
  updatedAt: timestamp,
};

describe('getReportingContextUsecase', () => {
  const execute = makeGetReportingContextUsecase({
    appContext: mockAppContext,
    fiscalYearRepo: mockFiscalYearRepo,
    reportingContextRepo: mockReportingContextRepo,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockFiscalYearRepo.findById.mockResolvedValue(fiscalYear);
    mockAppContext.get.mockReturnValue({
      correlationId: 'contexts-read',
      accountingEntity: { id: entityId },
    });
  });

  it('returns the context for the requested fiscal year and current entity', async () => {
    mockReportingContextRepo.findByFiscalYear.mockResolvedValue(context);
    await expect(execute(fiscalYearId)).resolves.toBe(context);
    expect(mockAppContext.get).toHaveBeenCalledWith(['accountingEntity']);
    expect(mockReportingContextRepo.findByFiscalYear).toHaveBeenCalledWith(
      entityId,
      fiscalYearId,
      {
        correlationId: 'contexts-read',
      }
    );
    expect(mockAppContext.set).not.toHaveBeenCalled();
  });

  it('returns a closed context for an accessible fiscal year', async () => {
    const closedContext = { ...context, closedAt: new Date('2026-12-31') };
    mockReportingContextRepo.findByFiscalYear.mockResolvedValue(closedContext);
    await expect(execute(fiscalYearId)).resolves.toBe(closedContext);
  });

  it('returns null for an absent context', async () => {
    mockReportingContextRepo.findByFiscalYear.mockResolvedValue(null);
    await expect(execute(fiscalYearId)).resolves.toBeNull();
  });

  it('rejects a missing fiscal year before querying the context', async () => {
    mockFiscalYearRepo.findById.mockResolvedValue(null);
    await expect(execute(fiscalYearId)).rejects.toBeInstanceOf(
      accountingAppError.FiscalYearNotFound
    );
    expect(mockFiscalYearRepo.findById).toHaveBeenCalledWith(
      entityId,
      fiscalYearId,
      { correlationId: 'contexts-read' }
    );
    expect(mockReportingContextRepo.findByFiscalYear).not.toHaveBeenCalled();
  });

  it('does not expose a fiscal year belonging to another entity', async () => {
    const otherId = '123e4567-e89b-12d3-a456-426614174099' as TEntityId;
    mockFiscalYearRepo.findById.mockImplementation(
      async (accountingEntityId, yearId) =>
        accountingEntityId === entityId && yearId === fiscalYearId
          ? fiscalYear
          : null
    );
    mockAppContext.get.mockReturnValue({
      accountingEntity: { id: otherId },
      correlationId: 'contexts-read',
    });
    await expect(execute(fiscalYearId)).rejects.toBeInstanceOf(
      accountingAppError.FiscalYearNotFound
    );
    expect(mockFiscalYearRepo.findById).toHaveBeenCalledWith(
      otherId,
      fiscalYearId,
      { correlationId: 'contexts-read' }
    );
    expect(mockReportingContextRepo.findByFiscalYear).not.toHaveBeenCalled();
  });

  it('propagates fiscal year read failures without querying contexts', async () => {
    const error = new Error('fiscal year read failed');
    mockFiscalYearRepo.findById.mockRejectedValue(error);
    await expect(execute(fiscalYearId)).rejects.toBe(error);
    expect(mockReportingContextRepo.findByFiscalYear).not.toHaveBeenCalled();
  });

  it.each(['', 'invalid', undefined, null])(
    'rejects invalid or missing fiscal year IDs: %j',
    async (id) => {
      await expect(execute(id as string)).rejects.toMatchObject({
        errorKey: 'app_error_validation_error',
      });
      expect(mockAppContext.get).not.toHaveBeenCalled();
      expect(mockFiscalYearRepo.findById).not.toHaveBeenCalled();
      expect(mockReportingContextRepo.findByFiscalYear).not.toHaveBeenCalled();
    }
  );

  it('propagates read failures', async () => {
    const error = new Error('read failed');
    mockReportingContextRepo.findByFiscalYear.mockRejectedValue(error);
    await expect(execute(fiscalYearId)).rejects.toBe(error);
  });

  it('does not query without required entity context', async () => {
    const error = new Error('context unavailable');
    mockAppContext.get.mockImplementation(() => {
      throw error;
    });
    await expect(execute(fiscalYearId)).rejects.toBe(error);
    expect(mockReportingContextRepo.findByFiscalYear).not.toHaveBeenCalled();
  });
});
