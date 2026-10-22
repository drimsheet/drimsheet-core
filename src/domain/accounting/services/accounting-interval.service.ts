import dateUtils from '@shared/utils/date';

import accountingIntervalEntity from '@domain/accounting/entities/accounting-interval.entity';
import accountingError from '@domain/accounting/errors/accounting.error';
import periodError from '@domain/accounting/errors/period.error';
import IAccountingIntervalRepo from '@domain/accounting/repos/accounting-interval.repo';
import IAccountingIntervalService from '@domain/accounting/types/accounting-interval.service.types';

interface IDependencies {
  accountingIntervalRepo: IAccountingIntervalRepo;
}

/**
 * Enforces one accounting interval per fiscal year (ACC-AI-001).
 * Storage uniqueness protects against concurrent creation.
 */
function makeCreate(deps: IDependencies): IAccountingIntervalService['create'] {
  return async (input, options) => {
    if (input.fiscalYear.accountingEntityId !== input.accountingEntityId) {
      throw new periodError.InvalidFiscalYearId();
    }

    const alreadyExists = await deps.accountingIntervalRepo.existsByFiscalYear(
      input.accountingEntityId,
      input.fiscalYear.id,
      options
    );
    if (alreadyExists) {
      throw new accountingError.AccountingIntervalAlreadyExists();
    }

    return accountingIntervalEntity.make({
      accountingEntityId: input.accountingEntityId,
      fiscalYearId: input.fiscalYear.id,
      createdBy: input.createdBy,
      unit: input.unit,
      count: input.count,
      periods: input.periods,
      startDate: input.fiscalYear.startDate,
      endDate: dateUtils.addUtcUnits(input.fiscalYear.endDate, 1, 'day'),
    });
  };
}

export default function makeAccountingIntervalService(
  deps: IDependencies
): IAccountingIntervalService {
  return Object.freeze({ create: makeCreate(deps) });
}
