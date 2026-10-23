import { TEntityId } from '@shared/types/uuid';

import accountingIntervalEntity from '@domain/accounting/entities/accounting-interval.entity';
import { IFiscalYear } from '@domain/accounting/types/fiscal-year.types';

import {
  mockAccountingIntervalRepo,
  mockFiscalYearRepo,
} from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import accountingAppError from '@app/accounting/errors/accounting.error';
import makeGetAccountingIntervalUsecase from '@app/accounting/usecases/get-accounting-interval.usecase';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';

const entityId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const actorId = 'a1111111-1111-4111-8111-111111111111' as TEntityId;
const fiscalYearId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
const timestamp = new Date('2026-01-01T00:00:00.000Z');
const [interval] = accountingIntervalEntity.make(
  {
    accountingEntityId: entityId,
    fiscalYearId,
    createdBy: actorId,
    unit: 'year',
    count: 1,
    startDate: timestamp,
    endDate: new Date('2027-01-01T00:00:00.000Z'),
    periods: [{ name: '2026' }],
  },
  timestamp
);
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

describe('getAccountingIntervalUsecase', () => {
  const execute = makeGetAccountingIntervalUsecase({
    appContext: mockAppContext,
    fiscalYearRepo: mockFiscalYearRepo,
    accountingIntervalRepo: mockAccountingIntervalRepo,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockFiscalYearRepo.findById.mockResolvedValue(fiscalYear);
    mockAppContext.get.mockReturnValue({
      correlationId: 'interval-read',
      accountingEntity: { id: entityId },
    });
  });

  it('returns the interval and its periods for the requested fiscal year and current entity', async () => {
    mockAccountingIntervalRepo.findByFiscalYear.mockResolvedValue(interval);
    await expect(execute(fiscalYearId)).resolves.toBe(interval);
    expect(mockAppContext.get).toHaveBeenCalledWith(['accountingEntity']);
    expect(mockAccountingIntervalRepo.findByFiscalYear).toHaveBeenCalledWith(
      entityId,
      fiscalYearId,
      {
        correlationId: 'interval-read',
      }
    );
    expect(mockAppContext.set).not.toHaveBeenCalled();
    expect(mockAccountingIntervalRepo.create).not.toHaveBeenCalled();
    expect(mockAccountingIntervalRepo.update).not.toHaveBeenCalled();
  });

  it('rejects an absent interval with the existing not-found error', async () => {
    mockAccountingIntervalRepo.findByFiscalYear.mockResolvedValue(null);
    await expect(execute(fiscalYearId)).rejects.toBeInstanceOf(
      accountingAppError.AccountingIntervalNotFound
    );
  });

  it('rejects a missing fiscal year before querying the interval', async () => {
    mockFiscalYearRepo.findById.mockResolvedValue(null);
    await expect(execute(fiscalYearId)).rejects.toBeInstanceOf(
      accountingAppError.FiscalYearNotFound
    );
    expect(mockFiscalYearRepo.findById).toHaveBeenCalledWith(
      entityId,
      fiscalYearId,
      { correlationId: 'interval-read' }
    );
    expect(mockAccountingIntervalRepo.findByFiscalYear).not.toHaveBeenCalled();
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
      correlationId: 'interval-read',
    });
    await expect(execute(fiscalYearId)).rejects.toBeInstanceOf(
      accountingAppError.FiscalYearNotFound
    );
    expect(mockFiscalYearRepo.findById).toHaveBeenCalledWith(
      otherId,
      fiscalYearId,
      { correlationId: 'interval-read' }
    );
    expect(mockAccountingIntervalRepo.findByFiscalYear).not.toHaveBeenCalled();
  });

  it('propagates fiscal year read failures without querying intervals', async () => {
    const error = new Error('fiscal year read failed');
    mockFiscalYearRepo.findById.mockRejectedValue(error);
    await expect(execute(fiscalYearId)).rejects.toBe(error);
    expect(mockAccountingIntervalRepo.findByFiscalYear).not.toHaveBeenCalled();
  });

  it.each(['', 'invalid', undefined, null])(
    'rejects invalid or missing fiscal year IDs: %j',
    async (id) => {
      await expect(execute(id as string)).rejects.toMatchObject({
        errorKey: 'app_error_validation_error',
        validationErrors: [
          {
            field: 'fiscalYearId',
            message: 'accounting_error_period_fiscal_year_id_invalid',
          },
        ],
      });
      expect(mockAppContext.get).not.toHaveBeenCalled();
      expect(mockFiscalYearRepo.findById).not.toHaveBeenCalled();
      expect(
        mockAccountingIntervalRepo.findByFiscalYear
      ).not.toHaveBeenCalled();
    }
  );

  it('propagates read failures', async () => {
    const error = new Error('read failed');
    mockAccountingIntervalRepo.findByFiscalYear.mockRejectedValue(error);
    await expect(execute(fiscalYearId)).rejects.toBe(error);
  });

  it('does not query without required entity context', async () => {
    const error = new Error('context unavailable');
    mockAppContext.get.mockImplementation(() => {
      throw error;
    });
    await expect(execute(fiscalYearId)).rejects.toBe(error);
    expect(mockAccountingIntervalRepo.findByFiscalYear).not.toHaveBeenCalled();
  });
});
