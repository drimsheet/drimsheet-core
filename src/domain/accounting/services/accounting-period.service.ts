import periodError from '@domain/accounting/errors/period.error';
import IAccountingPeriodRepo from '@domain/accounting/repos/accounting-period.repo';
import IAccountingPeriodService from '@domain/accounting/types/accounting-period.service.types';
import { EAccountingPeriodStatus } from '@domain/accounting/types/accounting-period.types';

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
    if (accountingPeriod.status !== EAccountingPeriodStatus.Open) {
      throw new periodError.PostingPeriodNotOpen({
        accountingEntityId,
        postingDate,
        accountingPeriodId: accountingPeriod.id,
        status: accountingPeriod.status,
      });
    }
  };
}

export default function makeAccountingPeriodService(
  deps: IDependencies
): IAccountingPeriodService {
  return Object.freeze({
    validatePostingPeriod: makeValidatePostingPeriod(deps),
  });
}
