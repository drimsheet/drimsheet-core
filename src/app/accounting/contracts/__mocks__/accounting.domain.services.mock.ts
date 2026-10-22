import IAccountingContextService from '@domain/accounting/types/accounting-context.service.types';
import IAccountingEntityService from '@domain/accounting/types/accounting-entity.service.types';
import IAccountingIntervalService from '@domain/accounting/types/accounting-interval.service.types';
import IAccountingPeriodService from '@domain/accounting/types/accounting-period.service.types';
import IFiscalYearService from '@domain/accounting/types/fiscal-year.service.types';
import IReportingContextService from '@domain/accounting/types/reporting-context.service.types';
import IReportingPeriodService from '@domain/accounting/types/reporting-period.service.types';

export const mockReportingContextService: jest.Mocked<IReportingContextService> =
  {
    updateCurrentReportingPeriod: jest.fn(),
    create: jest.fn(),
  };

export const mockReportingPeriodService: jest.Mocked<IReportingPeriodService> =
  {
    generate: jest.fn(),
  };

export const mockAccountingContextService: jest.Mocked<IAccountingContextService> =
  {
    create: jest.fn(),
    updateCurrentAccountingPeriod: jest.fn(),
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
    generate: jest.fn(),
    validatePostingPeriod: jest.fn(),
  };

export const mockAccountingIntervalService: jest.Mocked<IAccountingIntervalService> =
  {
    create: jest.fn(),
  };
