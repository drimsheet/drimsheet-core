import periodError from '@domain/accounting/errors/period.error';
import IAccountingPeriodRepo from '@domain/accounting/repos/accounting-period.repo';
import IAccountingPeriodService from '@domain/accounting/types/accounting-period.service.types';
import { EPeriodStatus } from '@domain/accounting/types/period.types';

interface IDependencies {
  accountingPeriodRepo: IAccountingPeriodRepo;
}

export default function makeAccountingPeriodService(
  deps: IDependencies
): IAccountingPeriodService {
  // TODO: Rename this value-returning validation to a check; reserve validate
  // for checks that only throw on failure and return no value.
  const validatePostingPeriod: IAccountingPeriodService['validatePostingPeriod'] =
    async (accountingEntityId, postingDate, repoOptions) => {
      const accountingPeriod = await deps.accountingPeriodRepo.findByDate(
        accountingEntityId,
        postingDate,
        repoOptions
      );

      if (!accountingPeriod) {
        throw new periodError.PostingDateNotCovered({
          accountingEntityId,
          postingDate,
        });
      }

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

  return Object.freeze({ validatePostingPeriod });
}
