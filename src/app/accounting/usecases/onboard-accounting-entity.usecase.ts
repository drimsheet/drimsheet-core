import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import {
  IRepoService,
  TRepoTransactionFn,
} from '@shared/contracts/repo.contract';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import { IEvent } from '@shared/values/events/types/event.types';
import historyValue from '@shared/values/history/history.vo';

import accountingContextEntity from '@domain/accounting/entities/accounting-context.entity';
import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';
import getPeriodContainingCurrentDate from '@domain/accounting/entities/helpers/get-current-period.helper';
import getAccountingJurisdiction from '@domain/accounting/entities/helpers/get-jurisdiction.helper';
import reportingContextEntity from '@domain/accounting/entities/reporting-context.entity';
import reportingPeriodEntity from '@domain/accounting/entities/reporting-period.entity';
import accountingContextValidation from '@domain/accounting/entities/validations/accounting-context.validation';
import fiscalYearValidation from '@domain/accounting/entities/validations/fiscal-year.validation';
import IAccountingContextRepo from '@domain/accounting/repos/accounting-context.repo';
import IAccountingEntityRepo from '@domain/accounting/repos/accounting-entity.repo';
import IAccountingPeriodRepo from '@domain/accounting/repos/accounting-period.repo';
import IFiscalYearRepo from '@domain/accounting/repos/fiscal-year.repo';
import IReportingContextRepo from '@domain/accounting/repos/reporting-context.repo';
import IReportingPeriodRepo from '@domain/accounting/repos/reporting-period.repo';
import accountingEntityServiceValidation from '@domain/accounting/services/validations/accounting-entity.validation';
import IAccountingEntityService from '@domain/accounting/types/accounting-entity.service.types';
import IAccountingPeriodService from '@domain/accounting/types/accounting-period.service.types';
import { EPeriodStatus } from '@domain/accounting/types/period.types';
import currencyEntity from '@domain/money/entities/currency.entity';

import { IAccountingEntityOnboardingDto } from '@app/accounting/dtos/accounting/accounting.dto';
import accountingEntityDtoMapper from '@app/accounting/dtos/accounting/accounting.dto.mapper';
import { accountingEntityOnboardingDtoSchema } from '@app/accounting/dtos/accounting/accounting.dto.validation';
import { IAppContextData } from '@app/context/types/app-context.types';
import IUserPreferencesAppService from '@app/user/contracts/user-preferences.service.contract';
import { EAppUsageModePreference } from '@app/user/types/user-preferences.types';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  accountingEntityRepo: IAccountingEntityRepo;
  userPreferencesAppService: IUserPreferencesAppService;
  fiscalYearRepo: IFiscalYearRepo;
  accountingPeriodRepo: IAccountingPeriodRepo;
  accountingContextRepo: IAccountingContextRepo;
  reportingPeriodRepo: IReportingPeriodRepo;
  reportingContextRepo: IReportingContextRepo;
  repoService: IRepoService;
  accountingEntityService: IAccountingEntityService;
  accountingPeriodService: IAccountingPeriodService;
  eventBus: IEventBus;
}

/** @deprecated Legacy combined onboarding; retained until its removal in the upcoming ticket. */
export default function makeOnboardAccountingEntityUsecase(
  deps: IDependencies
) {
  return async (payload: IAccountingEntityOnboardingDto) => {
    zodValidationRunner(accountingEntityOnboardingDtoSchema, payload);

    const { user, actor, correlationId } = deps.appContext.get([
      'user',
      'actor',
    ]);
    const repoOptions = { correlationId };

    const jurisdiction = getAccountingJurisdiction(payload.jurisdictionCode);
    accountingContextValidation.validateStandardCodeAndJurisdiction(
      payload.accountingStandardCode,
      payload.jurisdictionCode,
      payload.entityType
    );
    fiscalYearValidation.validateStartAndEndDate(payload.fiscalYear);
    accountingEntityServiceValidation.validateFiscalYearLimit(
      jurisdiction,
      payload.fiscalYear.startDate,
      payload.fiscalYear.endDate
    );
    const functionalCurrency = currencyEntity.getByCode(
      payload.functionalCurrencyCode
    );
    const reportingCurrency = currencyEntity.getByCode(
      payload.reportingCurrencyCode
    );

    const entityCreation = await deps.accountingEntityService.create(
      {
        createdBy: actor.id,
        name: payload.name,
        type: payload.entityType,
        ownerId: user.id,
        functionalCurrencyCode: functionalCurrency.code,
        jurisdictionCode: payload.jurisdictionCode,
      },
      repoOptions
    );
    const [accountingEntity, accountingEntityEvents, accountingEntityAudit] =
      entityCreation;

    const fiscalYearCreation = fiscalYearEntity.make({
      createdBy: actor.id,
      accountingEntityId: accountingEntity.id,
      startDate: payload.fiscalYear.startDate,
      endDate: payload.fiscalYear.endDate,
      status: EPeriodStatus.Open,
    });
    const [fiscalYear, fiscalYearEvents, fiscalYearAudit] = fiscalYearCreation;

    const accountingPeriodData = await deps.accountingPeriodService.generate(
      {
        createdBy: actor.id,
        accountingEntityId: accountingEntity.id,
        unit: payload.accountingPeriod.unit,
        count: payload.accountingPeriod.count,
        fiscalYear,
      },
      repoOptions
    );
    const currentAccountingPeriod =
      getPeriodContainingCurrentDate(
        accountingPeriodData.map(([period]) => period)
      ) ?? accountingPeriodData[0][0];

    const accountingContextCreation = accountingContextEntity.make({
      createdBy: actor.id,
      name: 'Default Accounting Context',
      description: null,
      accountingEntityId: accountingEntity.id,
      accountingStandardCode: payload.accountingStandardCode,
      fiscalYearId: fiscalYear.id,
      currentAccountingPeriodId: currentAccountingPeriod.id,
    });
    const [accountingContext, accountingContextEvents, accountingContextAudit] =
      accountingContextCreation;

    const reportingPeriodData = reportingPeriodEntity.make({
      createdBy: actor.id,
      accountingEntityId: accountingEntity.id,
      unit: payload.reportingPeriod.unit,
      count: payload.reportingPeriod.count,
      fiscalYear,
    });
    const currentReportingPeriod =
      getPeriodContainingCurrentDate(
        reportingPeriodData.map(([period]) => period)
      ) ?? reportingPeriodData[0][0];

    const reportingContextCreation = reportingContextEntity.make({
      createdBy: actor.id,
      name: 'Default Reporting Context',
      description: null,
      accountingEntityId: accountingEntity.id,
      reportingCurrencyCode: reportingCurrency.code,
      accountingContextId: accountingContext.id,
      currentReportingPeriodId: currentReportingPeriod.id,
      accountingStandardCode: payload.accountingStandardCode,
    });
    const [reportingContext, reportingContextEvents, reportingContextAudit] =
      reportingContextCreation;

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

      await deps.userPreferencesAppService.update(
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

    return accountingEntityDtoMapper.toDto(accountingEntity);
  };
}
