import accountingPeriodValidation from '@domain/accounting/entities/validations/accounting-period.validation';
import IAccountingPeriodRepo from '@domain/accounting/repos/accounting-period.repo';
import IAccountingPeriodService from '@domain/accounting/types/accounting-period.service.types';

interface IDependencies {
  accountingPeriodRepo: IAccountingPeriodRepo;
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
    accountingPeriodValidation.validatePostingPeriod(
      accountingEntityId,
      postingDate,
      accountingPeriods
    );
  };
}

export default function makeAccountingPeriodService(
  deps: IDependencies
): IAccountingPeriodService {
  return Object.freeze({
    validatePostingPeriod: makeValidatePostingPeriod(deps),
  });
}
