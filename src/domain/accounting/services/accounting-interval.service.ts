import dateUtils from '@shared/utils/date';

import accountingIntervalEntity from '@domain/accounting/entities/accounting-interval.entity';
import periodError from '@domain/accounting/errors/period.error';
import IAccountingIntervalRepo from '@domain/accounting/repos/accounting-interval.repo';
import IAccountingIntervalService from '@domain/accounting/types/accounting-interval.service.types';

interface IDependencies {
  accountingIntervalRepo: IAccountingIntervalRepo;
}

/** Prepares an owned fiscal-year calendar and rejects stored overlap. */
function makeCreate(deps: IDependencies): IAccountingIntervalService['create'] {
  return async (input, options) => {
    if (input.fiscalYear.accountingEntityId !== input.accountingEntityId) {
      throw new periodError.InvalidFiscalYearId();
    }

    const range = {
      startDate: input.fiscalYear.startDate,
      endDate: dateUtils.addUtcUnits(input.fiscalYear.endDate, 1, 'day'),
    };

    const creation = accountingIntervalEntity.make({
      accountingEntityId: input.accountingEntityId,
      fiscalYearId: input.fiscalYear.id,
      createdBy: input.createdBy,
      unit: input.unit,
      count: input.count,
      periods: input.periods,
      ...range,
    });

    const hasOverlap = await deps.accountingIntervalRepo.existsByRange(
      input.accountingEntityId,
      range,
      options
    );
    if (hasOverlap) {
      throw new periodError.OverlappingPeriods();
    }

    return creation;
  };
}

export default function makeAccountingIntervalService(
  deps: IDependencies
): IAccountingIntervalService {
  return Object.freeze({ create: makeCreate(deps) });
}
