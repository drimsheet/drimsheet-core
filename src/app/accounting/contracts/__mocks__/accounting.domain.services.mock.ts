import IAccountingContextService from '@domain/accounting/types/accounting-context.service.types';
import IAccountingEntityService from '@domain/accounting/types/accounting-entity.service.types';
import IAccountingIntervalService from '@domain/accounting/types/accounting-interval.service.types';
import IAccountingPeriodService from '@domain/accounting/types/accounting-period.service.types';
import IFiscalYearService from '@domain/accounting/types/fiscal-year.service.types';
import IReportingContextService from '@domain/accounting/types/reporting-context.service.types';
import IReportingIntervalService from '@domain/accounting/types/reporting-interval.service.types';

export const mockReportingContextService: jest.Mocked<IReportingContextService> =
  {
    create: jest.fn(),
  };

export const mockAccountingContextService: jest.Mocked<IAccountingContextService> =
  {
    create: jest.fn(),
  };

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
    validatePostingPeriod: jest.fn(),
  };

export const mockAccountingIntervalService: jest.Mocked<IAccountingIntervalService> =
  {
    create: jest.fn(),
  };

export const mockReportingIntervalService: jest.Mocked<IReportingIntervalService> =
  {
    create: jest.fn(),
  };
