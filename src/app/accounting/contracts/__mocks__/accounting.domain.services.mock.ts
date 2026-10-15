import IAccountingEntityService from '@domain/accounting/types/accounting-entity.service.types';
import IAccountingPeriodService from '@domain/accounting/types/accounting-period.service.types';

export const mockAccountingEntityService: jest.Mocked<IAccountingEntityService> =
  {
    create: jest.fn(),
    update: jest.fn(),
    grantUserAccess: jest.fn(),
    validateAccess: jest.fn(),
  };

export const mockAccountingPeriodService: jest.Mocked<IAccountingPeriodService> =
  {
    generate: jest.fn(),
    validatePostingPeriod: jest.fn(),
  };
