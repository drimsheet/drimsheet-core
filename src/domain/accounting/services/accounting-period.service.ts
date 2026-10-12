import accountingPeriodEntity from '@domain/accounting/entities/accounting-period.entity';
import periodError from '@domain/accounting/errors/period.error';
import IAccountingPeriodRepo from '@domain/accounting/repos/accounting-period.repo';
import IAccountingPeriodService from '@domain/accounting/types/accounting-period.service.types';
import { EPeriodStatus } from '@domain/accounting/types/period.types';

interface IDependencies {
  accountingPeriodRepo: IAccountingPeriodRepo;
}

/** Rejects stored conflicts before requesting the entity's period array. Storage enforces non-overlap against races. */
function makeGenerate(
  deps: IDependencies
): IAccountingPeriodService['generate'] {
  return async (input, repoOptions) => {
    accountingPeriodEntity.validateFiscalYearOwnership(
      input.accountingEntityId,
      input.fiscalYear
    );
    const existingPeriods = await deps.accountingPeriodRepo.findByRange(
      input.accountingEntityId,
      {
        startDate: input.fiscalYear.startDate,
        endDate: input.fiscalYear.endDate,
      },
      repoOptions
    );
    if (existingPeriods.length > 0) {
      throw new periodError.OverlappingPeriods({
        accountingEntityId: input.accountingEntityId,
        startDate: input.fiscalYear.startDate,
        endDate: input.fiscalYear.endDate,
        accountingPeriodIds: existingPeriods.map((period) => period.id),
      });
    }

    return accountingPeriodEntity.make({
      createdBy: input.createdBy,
      accountingEntityId: input.accountingEntityId,
      fiscalYear: input.fiscalYear,
      unit: input.unit,
      count: input.count,
    });
  };
}

/** Requires exactly one covering period before checking that it is Open. */
function makeValidatePostingPeriod(
  deps: IDependencies
): IAccountingPeriodService['validatePostingPeriod'] {
  return async (accountingEntityId, postingDate, repoOptions) => {
    const accountingPeriods = await deps.accountingPeriodRepo.findAllByDate(
      accountingEntityId,
      postingDate,
      repoOptions
    );
    if (accountingPeriods.length === 0) {
      throw new periodError.PostingDateNotCovered({
        accountingEntityId,
        postingDate,
      });
    }
    if (accountingPeriods.length > 1) {
      throw new periodError.PostingPeriodAmbiguous({
        accountingEntityId,
        postingDate,
        accountingPeriodIds: accountingPeriods.map((period) => period.id),
      });
    }

    const [accountingPeriod] = accountingPeriods;
    if (accountingPeriod.status !== EPeriodStatus.Open) {
      throw new periodError.PostingPeriodNotOpen({
        accountingEntityId,
        postingDate,
        accountingPeriodId: accountingPeriod.id,
        status: accountingPeriod.status,
      });
    }
    return accountingPeriod;
  };
}

export default function makeAccountingPeriodService(
  deps: IDependencies
): IAccountingPeriodService {
  return Object.freeze({
    generate: makeGenerate(deps),
    validatePostingPeriod: makeValidatePostingPeriod(deps),
  });
}
