import IAppContextService from '@shared/contracts/app-context.service.contract';
import dateUtils from '@shared/utils/date';

import INextCurrentReportingPeriodQueryRepo from '@app/accounting/contracts/next-current-reporting-period.query.repo.contract';
import { INextCurrentReportingPeriodDto } from '@app/accounting/dtos/current-reporting-period/current-reporting-period.dto';
import { IAppContextData } from '@app/context/types/app-context.types';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  nextCurrentReportingPeriodQueryRepo: INextCurrentReportingPeriodQueryRepo;
}

export default function makeGetNextCurrentReportingPeriodUsecase(
  deps: IDependencies
) {
  return async (): Promise<INextCurrentReportingPeriodDto[]> => {
    const { correlationId } = deps.appContext.get();

    return await deps.nextCurrentReportingPeriodQueryRepo.findDue(
      dateUtils.now(),
      {
        correlationId,
      }
    );
  };
}
