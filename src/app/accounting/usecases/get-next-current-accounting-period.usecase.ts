import IAppContextService from '@shared/contracts/app-context.service.contract';
import dateUtils from '@shared/utils/date';

import INextCurrentAccountingPeriodQueryRepo from '@app/accounting/contracts/next-current-accounting-period.query.repo.contract';
import { INextCurrentAccountingPeriodDto } from '@app/accounting/dtos/current-accounting-period/current-accounting-period.dto';
import { IAppContextData } from '@app/context/types/app-context.types';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  nextCurrentAccountingPeriodQueryRepo: INextCurrentAccountingPeriodQueryRepo;
}

export default function makeGetNextCurrentAccountingPeriodUsecase(
  deps: IDependencies
) {
  return async (): Promise<INextCurrentAccountingPeriodDto[]> => {
    const { correlationId } = deps.appContext.get();

    return await deps.nextCurrentAccountingPeriodQueryRepo.findDue(
      dateUtils.now(),
      {
        correlationId,
      }
    );
  };
}
