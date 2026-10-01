import IAccountingContextHistoryRepo from '@domain/accounting/repos/accounting-context-history.repo';
import IAccountingContextRepo from '@domain/accounting/repos/accounting-context.repo';
import IAccountingEntityHistoryRepo from '@domain/accounting/repos/accounting-entity-history.repo';
import IAccountingEntityRepo from '@domain/accounting/repos/accounting-entity.repo';
import IAccountingPeriodHistoryRepo from '@domain/accounting/repos/accounting-period-history.repo';
import IAccountingPeriodRepo from '@domain/accounting/repos/accounting-period.repo';
import { IAccountingStandardRepo } from '@domain/accounting/repos/accounting-standards.repo';
import IFiscalYearHistoryRepo from '@domain/accounting/repos/fiscal-year-history.repo';
import IFiscalYearRepo from '@domain/accounting/repos/fiscal-year.repo';
import IJurisdictionAccountingStandardRepo from '@domain/accounting/repos/jurisdiction-accounting-standard.repo';
import IJurisdictionRepo from '@domain/accounting/repos/jurisdiction.repo';
import IReportingContextHistoryRepo from '@domain/accounting/repos/reporting-context-history.repo';
import IReportingContextRepo from '@domain/accounting/repos/reporting-context.repo';
import IReportingPeriodHistoryRepo from '@domain/accounting/repos/reporting-period-history.repo';
import IReportingPeriodRepo from '@domain/accounting/repos/reporting-period.repo';

export const mockAccountingContextHistoryRepo: jest.Mocked<IAccountingContextHistoryRepo> =
  {
    save: jest.fn(),
  };

export const mockAccountingContextRepo: jest.Mocked<IAccountingContextRepo> = {
  create: jest.fn(),
};

export const mockAccountingEntityHistoryRepo: jest.Mocked<IAccountingEntityHistoryRepo> =
  {
    save: jest.fn(),
  };

export const mockAccountingEntityRepo: jest.Mocked<IAccountingEntityRepo> = {
  create: jest.fn(),
  findById: jest.fn(),
  findByIdAndUserId: jest.fn(),
  findByUserId: jest.fn(),
};

export const mockAccountingPeriodHistoryRepo: jest.Mocked<IAccountingPeriodHistoryRepo> =
  {
    save: jest.fn(),
  };

export const mockAccountingPeriodRepo: jest.Mocked<IAccountingPeriodRepo> = {
  findByDate: jest.fn(),
  create: jest.fn(),
};

export const mockAccountingStandardRepo: jest.Mocked<IAccountingStandardRepo> =
  {
    create: jest.fn(),
  };

export const mockFiscalYearHistoryRepo: jest.Mocked<IFiscalYearHistoryRepo> = {
  save: jest.fn(),
};

export const mockFiscalYearRepo: jest.Mocked<IFiscalYearRepo> = {
  create: jest.fn(),
};

export const mockJurisdictionAccountingStandardRepo: jest.Mocked<IJurisdictionAccountingStandardRepo> =
  {
    create: jest.fn(),
  };

export const mockJurisdictionRepo: jest.Mocked<IJurisdictionRepo> = {
  create: jest.fn(),
};

export const mockReportingContextHistoryRepo: jest.Mocked<IReportingContextHistoryRepo> =
  {
    save: jest.fn(),
  };

export const mockReportingContextRepo: jest.Mocked<IReportingContextRepo> = {
  create: jest.fn(),
};

export const mockReportingPeriodHistoryRepo: jest.Mocked<IReportingPeriodHistoryRepo> =
  {
    save: jest.fn(),
  };

export const mockReportingPeriodRepo: jest.Mocked<IReportingPeriodRepo> = {
  create: jest.fn(),
};
