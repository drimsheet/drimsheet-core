import IReportingContextQueryRepo from '@app/accounting/contracts/reporting-context.query.repo.contract';
import { IReportingContextDto } from '@app/accounting/dtos/reporting-context/reporting-context.dto';
import reportingContextDtoMapper from '@app/accounting/dtos/reporting-context/reporting-context.dto.mapper';
import IAppContext from '@app/context/contracts/app-context.contract';

interface IDependencies {
  appContext: IAppContext;
  reportingContextQueryRepo: IReportingContextQueryRepo;
}

export default function makeGetReportingContextsUsecase(deps: IDependencies) {
  return async (): Promise<IReportingContextDto[]> => {
    const { accountingEntity, correlationId } = deps.appContext.get([
      'accountingEntity',
    ]);

    const contexts =
      await deps.reportingContextQueryRepo.findActiveByAccountingEntityId(
        accountingEntity.id,
        { correlationId }
      );

    return contexts.map(reportingContextDtoMapper.toDto);
  };
}
