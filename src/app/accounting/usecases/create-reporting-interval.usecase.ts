import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import {
  IRepoService,
  TRepoTransactionFn,
} from '@shared/contracts/repo.contract';
import { TEntityId } from '@shared/types/uuid';
import dateUtils from '@shared/utils/date';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import reportingIntervalEntity from '@domain/accounting/entities/reporting-interval.entity';
import IFiscalYearRepo from '@domain/accounting/repos/fiscal-year.repo';
import IReportingIntervalRepo from '@domain/accounting/repos/reporting-interval.repo';
import IReportingPeriodRepo from '@domain/accounting/repos/reporting-period.repo';
import { IReportingInterval } from '@domain/accounting/types/reporting-period.types';

import { IReportingIntervalCreationReq } from '@app/accounting/dtos/reporting-interval/reporting-interval.dto';
import { reportingIntervalCreationDtoSchema } from '@app/accounting/dtos/reporting-interval/reporting-interval.dto.validation';
import accountingAppError from '@app/accounting/errors/accounting.error';
import { IAppContextData } from '@app/context/types/app-context.types';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  fiscalYearRepo: IFiscalYearRepo;
  reportingIntervalRepo: IReportingIntervalRepo;
  reportingPeriodRepo: IReportingPeriodRepo;
  repoService: IRepoService;
  eventBus: IEventBus;
}

export default function makeCreateReportingIntervalUsecase(
  deps: IDependencies
) {
  return async (
    payload: IReportingIntervalCreationReq
  ): Promise<IReportingInterval> => {
    zodValidationRunner(reportingIntervalCreationDtoSchema, payload);

    const { accountingEntity, actor, correlationId } = deps.appContext.get([
      'accountingEntity',
      'actor',
    ]);

    const repoOptions = { correlationId };

    const fiscalYear = await deps.fiscalYearRepo.findById(
      accountingEntity.id,
      payload.fiscalYearId as TEntityId,
      repoOptions
    );
    if (!fiscalYear) {
      throw new accountingAppError.FiscalYearNotFound();
    }

    const creationInput = {
      accountingEntityId: accountingEntity.id,
      fiscalYearId: fiscalYear.id,
      createdBy: actor.id,
      unit: payload.unit,
      count: payload.count,
      periods: payload.periods,
      startDate: fiscalYear.startDate,
      endDate: dateUtils.addUtcUnits(fiscalYear.endDate, 1, 'day'),
    };

    const [interval, events, audits] =
      reportingIntervalEntity.make(creationInput);

    const intervalHistory = historyValue.make(
      audits.interval,
      actor.id,
      correlationId
    );
    const periodHistories = audits.periods.map((audit) =>
      historyValue.make(audit, actor.id, correlationId)
    );
    const { periods, ...intervalHeader } = interval;

    const dbTransactionFn: TRepoTransactionFn = async (tx) => {
      const writeOptions = { correlationId, tx };

      await deps.reportingIntervalRepo.create(intervalHeader, {
        ...writeOptions,
        history: intervalHistory,
      });
      await deps.reportingPeriodRepo.create(periods, {
        ...writeOptions,
        history: periodHistories,
      });
    };

    await deps.repoService.runInTransaction(dbTransactionFn);

    await deps.eventBus.publish(eventValue.enrichAll(events, repoOptions));

    return interval;
  };
}
