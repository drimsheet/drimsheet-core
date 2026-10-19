import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import IFiscalYearRepo from '@domain/accounting/repos/fiscal-year.repo';
import IReportingPeriodRepo from '@domain/accounting/repos/reporting-period.repo';
import IReportingPeriodService from '@domain/accounting/types/reporting-period.service.types';

import {
  IReportingPeriodDto,
  IReportingPeriodsCreationReq,
} from '@app/accounting/dtos/reporting-period/reporting-period.dto';
import reportingPeriodDtoMapper from '@app/accounting/dtos/reporting-period/reporting-period.dto.mapper';
import { reportingPeriodsCreationDtoSchema } from '@app/accounting/dtos/reporting-period/reporting-period.dto.validation';
import accountingAppError from '@app/accounting/errors/accounting.error';
import { IAppContextData } from '@app/context/types/app-context.types';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  fiscalYearRepo: IFiscalYearRepo;
  reportingPeriodService: IReportingPeriodService;
  reportingPeriodRepo: IReportingPeriodRepo;
  eventBus: IEventBus;
}

export default function makeCreateReportingPeriodsUsecase(deps: IDependencies) {
  return async (
    payload: IReportingPeriodsCreationReq
  ): Promise<IReportingPeriodDto[]> => {
    zodValidationRunner(reportingPeriodsCreationDtoSchema, payload);

    const { accountingEntity, actor, correlationId } = deps.appContext.get([
      'accountingEntity',
      'actor',
    ]);

    const repoOptions = { correlationId };

    const fiscalYear = await deps.fiscalYearRepo.findById(
      payload.fiscalYearId as TEntityId,
      repoOptions
    );
    if (!fiscalYear) {
      throw new accountingAppError.FiscalYearNotFound();
    }

    const creationInput = {
      accountingEntityId: accountingEntity.id,
      fiscalYear,
      createdBy: actor.id,
      unit: payload.unit,
      count: payload.count,
    };

    const creations = await deps.reportingPeriodService.generate(
      creationInput,
      repoOptions
    );

    const periods = creations.map(([period]) => period);

    const histories = creations.map(([, , audit]) =>
      historyValue.make(audit, actor.id, correlationId)
    );
    const events = creations.flatMap(([, periodEvents]) => periodEvents);

    await deps.reportingPeriodRepo.create(periods, {
      ...repoOptions,
      history: histories,
    });

    // TODO (ENG-218): Schedule background transitions of the current reporting period
    // together with accounting-period transitions. Report execution is separate.
    // https://drimsheet-app.atlassian.net/browse/ENG-218

    await deps.eventBus.publish(eventValue.enrichAll(events, repoOptions));

    return periods.map(reportingPeriodDtoMapper.toDto);
  };
}
