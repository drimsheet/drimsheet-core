import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import IAccountingContextRepo from '@domain/accounting/repos/accounting-context.repo';
import IReportingContextRepo from '@domain/accounting/repos/reporting-context.repo';
import IReportingPeriodRepo from '@domain/accounting/repos/reporting-period.repo.deprecated';
import { IReportingContext } from '@domain/accounting/types/context.types';
import IReportingContextService from '@domain/accounting/types/reporting-context.service.types';

import { IReportingContextCreationReq } from '@app/accounting/dtos/reporting-context/reporting-context.dto';
import { reportingContextCreationDtoSchema } from '@app/accounting/dtos/reporting-context/reporting-context.dto.validation';
import accountingAppError from '@app/accounting/errors/accounting.error';
import { IAppContextData } from '@app/context/types/app-context.types';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  reportingContextService: IReportingContextService;
  accountingContextRepo: IAccountingContextRepo;
  reportingPeriodRepo: IReportingPeriodRepo;
  reportingContextRepo: IReportingContextRepo;
  eventBus: IEventBus;
}

export default function makeCreateReportingContextUsecase(deps: IDependencies) {
  return async (
    payload: IReportingContextCreationReq
  ): Promise<IReportingContext> => {
    zodValidationRunner(reportingContextCreationDtoSchema, payload);

    const { accountingEntity, actor, correlationId } = deps.appContext.get([
      'accountingEntity',
      'actor',
    ]);
    const repoOptions = { correlationId };

    const accountingContext = await deps.accountingContextRepo.findById(
      payload.accountingContextId as TEntityId,
      repoOptions
    );
    if (!accountingContext) {
      throw new accountingAppError.AccountingContextNotFound();
    }

    const reportingPeriod = await deps.reportingPeriodRepo.findById(
      payload.currentReportingPeriodId as TEntityId,
      repoOptions
    );
    if (!reportingPeriod) {
      throw new accountingAppError.ReportingPeriodNotFound();
    }

    const [context, events, audit] = await deps.reportingContextService.create(
      {
        accountingEntity,
        accountingContext,
        reportingPeriod,
        accountingStandardCode: payload.accountingStandardCode,
        reportingCurrencyCode: payload.reportingCurrencyCode,
        name: payload.name,
        description: payload.description,
        createdBy: actor.id,
      },
      repoOptions
    );

    const history = historyValue.make(audit, actor.id, correlationId);

    await deps.reportingContextRepo.create(context, {
      ...repoOptions,
      history,
    });

    await deps.eventBus.publish(eventValue.enrichAll(events, repoOptions));

    return context;
  };
}
