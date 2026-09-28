import IEventBus from '@shared/contracts/event-bus.contract';
import {
  IRepoService,
  TRepoTransactionFn,
} from '@shared/contracts/repo.contract';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import { IEvent } from '@shared/values/events/types/event.types';
import historyValue from '@shared/values/history/history.vo';

import IAccountingContextRepo from '@domain/accounting/repos/accounting-context.repo';
import IAccountingEntityRepo from '@domain/accounting/repos/accounting-entity.repo';
import IAccountingPeriodRepo from '@domain/accounting/repos/accounting-period.repo';
import IFiscalYearRepo from '@domain/accounting/repos/fiscal-year.repo';
import IReportingContextRepo from '@domain/accounting/repos/reporting-context.repo';
import IReportingPeriodRepo from '@domain/accounting/repos/reporting-period.repo';
import IAccountingEntityService from '@domain/accounting/types/accounting-entity.service.types';

import { IAccountingEntityCreationDto } from '@app/accounting/dtos/accounting/accounting.dto';
import { accountingEntityOnboardingDtoSchema } from '@app/accounting/dtos/accounting/accounting.dto.validation';
import IAppContext from '@app/context/contracts/app-context.contract';
import IUserPreferencesService from '@app/user/contracts/user-preferences.service.contract';
import { EAppUsageModePreference } from '@app/user/types/user-preferences.types';

interface IDependencies {
  appContext: IAppContext;
  accountingEntityRepo: IAccountingEntityRepo;
  userPreferencesService: IUserPreferencesService;
  fiscalYearRepo: IFiscalYearRepo;
  accountingPeriodRepo: IAccountingPeriodRepo;
  accountingContextRepo: IAccountingContextRepo;
  reportingPeriodRepo: IReportingPeriodRepo;
  reportingContextRepo: IReportingContextRepo;
  repoService: IRepoService;
  accountingEntityService: IAccountingEntityService;
  eventBus: IEventBus;
}

export default function createAccountingEntityUseCase(deps: IDependencies) {
  return async (payload: IAccountingEntityCreationDto) => {
    zodValidationRunner(accountingEntityOnboardingDtoSchema, payload);

    const { user, actor, correlationId } = deps.appContext.get([
      'user',
      'actor',
    ]);
    const repoOptions = { correlationId };

    const accountingResponse = await deps.accountingEntityService.create(
      {
        name: payload.name,
        type: payload.entityType,
        ownerId: user.id,
        createdBy: actor.id,
        functionalCurrencyCode: payload.functionalCurrencyCode,
        reportingCurrencyCode: payload.reportingCurrencyCode,
        jurisdictionCode: payload.jurisdictionCode,
        accountingStandardCode: payload.accountingStandardCode,
        fiscalYear: payload.fiscalYear,
        accountingPeriod: payload.accountingPeriod,
        reportingPeriod: payload.reportingPeriod,
      },
      repoOptions
    );

    const {
      accountingEntity: [
        accountingEntity,
        accountingEntityEvents,
        accountingEntityAudit,
      ],
      fiscalYear: [fiscalYear, fiscalYearEvents, fiscalYearAudit],
      accountingPeriods: accountingPeriodData,
      accountingContext: [
        accountingContext,
        accountingContextEvents,
        accountingContextAudit,
      ],
      reportingPeriods: reportingPeriodData,
      reportingContext: [
        reportingContext,
        reportingContextEvents,
        reportingContextAudit,
      ],
    } = accountingResponse;

    const accountingPeriods = accountingPeriodData.map(([entity]) => entity);
    const reportingPeriods = reportingPeriodData.map(([entity]) => entity);

    const accountingEntityHistory = historyValue.make(
      accountingEntityAudit,
      actor.id,
      correlationId
    );

    const fiscalYearHistory = historyValue.make(
      fiscalYearAudit,
      actor.id,
      correlationId
    );

    const accountingPeriodHistories = accountingPeriodData.map(([, , audit]) =>
      historyValue.make(audit, actor.id, correlationId)
    );

    const accountingContextHistory = historyValue.make(
      accountingContextAudit,
      actor.id,
      correlationId
    );

    const reportingPeriodHistories = reportingPeriodData.map(([, , audit]) =>
      historyValue.make(audit, actor.id, correlationId)
    );

    const reportingContextHistory = historyValue.make(
      reportingContextAudit,
      actor.id,
      correlationId
    );

    const userPreferencesPayload = {
      userId: user.id,
      createdBy: actor.id,
      lastActiveAccountingEntityId: accountingEntity.id,
      appPreferences: {
        appUsageMode: EAppUsageModePreference.NonPowerUser,
      },
    };

    const transactionFn: TRepoTransactionFn = async (tx) => {
      const writeRepoOptions = { ...repoOptions, tx };

      await deps.accountingEntityRepo.create(accountingEntity, {
        ...writeRepoOptions,
        history: accountingEntityHistory,
      });

      await deps.userPreferencesService.update(
        userPreferencesPayload,
        writeRepoOptions
      );

      await deps.fiscalYearRepo.create(fiscalYear, {
        ...writeRepoOptions,
        history: fiscalYearHistory,
      });

      await deps.accountingPeriodRepo.create(accountingPeriods, {
        ...writeRepoOptions,
        history: accountingPeriodHistories,
      });

      await deps.accountingContextRepo.create(accountingContext, {
        ...writeRepoOptions,
        history: accountingContextHistory,
      });

      await deps.reportingPeriodRepo.create(reportingPeriods, {
        ...writeRepoOptions,
        history: reportingPeriodHistories,
      });

      await deps.reportingContextRepo.create(reportingContext, {
        ...writeRepoOptions,
        history: reportingContextHistory,
      });
    };

    await deps.repoService.runInTransaction(transactionFn);

    deps.appContext.set({ accountingEntity });

    const accountingPeriodEvents = accountingPeriodData.flatMap(
      ([, periodEvents]) => periodEvents
    );
    const reportingPeriodEvents = reportingPeriodData.flatMap(
      ([, periodEvents]) => periodEvents
    );

    const events: IEvent<unknown>[] = [
      ...accountingEntityEvents,
      ...fiscalYearEvents,
      ...accountingPeriodEvents,
      ...accountingContextEvents,
      ...reportingPeriodEvents,
      ...reportingContextEvents,
    ];

    const enrichedEvents = eventValue.enrichAll(events, repoOptions);

    await deps.eventBus.publish(enrichedEvents);

    return accountingEntity;
  };
}
