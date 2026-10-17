import IAccountingEntityService from '@domain/accounting/types/accounting-entity.service.types';
import IAccountingPeriodService from '@domain/accounting/types/accounting-period.service.types';
import IFiscalYearService from '@domain/accounting/types/fiscal-year.service.types';

export const mockFiscalYearService: jest.Mocked<IFiscalYearService> = {
  create: jest.fn(),
};

export const mockAccountingEntityService: jest.Mocked<IAccountingEntityService> =
  {
    create: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
    grantUserAccess: jest.fn(),
    validateAccess: jest.fn(),
  };

export const mockAccountingPeriodService: jest.Mocked<IAccountingPeriodService> =
  {
    generate: jest.fn(),
    validatePostingPeriod: jest.fn(),
  };
