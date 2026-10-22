import makeArchiveAccountingEntityUsecase from '@app/accounting/usecases/archive-accounting-entity.usecase';
import makeCreateAccountingContextUsecase from '@app/accounting/usecases/create-accounting-context.usecase';
import makeCreateAccountingEntityUseCase from '@app/accounting/usecases/create-accounting-entity.usecase';
import makeCreateAccountingPeriodsUsecase from '@app/accounting/usecases/create-accounting-periods.usecase';
import makeCreateFiscalYearUsecase from '@app/accounting/usecases/create-fiscal-year.usecase';
import makeCreateReportingContextUsecase from '@app/accounting/usecases/create-reporting-context.usecase';
import makeCreateReportingPeriodsUsecase from '@app/accounting/usecases/create-reporting-periods.usecase';
import makeDeleteAccountingEntityUsecase from '@app/accounting/usecases/delete-accounting-entity.usecase';
import makeGetAccountingContextUsecase from '@app/accounting/usecases/get-accounting-context.usecase';
import makeGetAccountingPeriodUsecase from '@app/accounting/usecases/get-accounting-period.usecase';
import makeGetAccountingPeriodsUsecase from '@app/accounting/usecases/get-accounting-periods.usecase';
import makeGetCurrentAccountingEntityUseCase from '@app/accounting/usecases/get-active-accounting-entity.usecase';
import makeGetFiscalYearUsecase from '@app/accounting/usecases/get-fiscal-year.usecase';
import makeGetFiscalYearsUsecase from '@app/accounting/usecases/get-fiscal-years.usecase';
import makeGetJurisdictionsUseCase from '@app/accounting/usecases/get-jurisdictions.usecase';
import makeGetNextCurrentAccountingPeriodUsecase from '@app/accounting/usecases/get-next-current-accounting-period.usecase';
import makeGetNextCurrentReportingPeriodUsecase from '@app/accounting/usecases/get-next-current-reporting-period.usecase';
import makeGetReportingContextUsecase from '@app/accounting/usecases/get-reporting-context.usecase';
import makeGetReportingPeriodsUsecase from '@app/accounting/usecases/get-reporting-periods.usecase';
import makeGetUserAccountingEntitiesUseCase from '@app/accounting/usecases/get-user-accounting-entities.usecase';
import makeSetCurrentAccountingPeriodUsecase from '@app/accounting/usecases/set-current-accounting-period.usecase';
import makeSetCurrentReportingPeriodUsecase from '@app/accounting/usecases/set-current-reporting-period.usecase';
import makeSwitchAccountingEntityUsecase from '@app/accounting/usecases/switch-accounting-entity.usecase';
import makeUpdateAccountingEntityUsecase from '@app/accounting/usecases/update-accounting-entity.usecase';

import {
  accountingContextService,
  accountingEntityService,
  accountingPeriodService,
  fiscalYearService,
  reportingContextService,
  reportingPeriodService,
} from '@infra/ioc/services/accounting';
import { repoService } from '@infra/ioc/services/repo';
import { userPreferencesAppService } from '@infra/ioc/services/user';
import messaging from '@infra/messaging';
import { makeTracedUseCase } from '@infra/observability/usecase-tracing';
import accountingRepos from '@infra/persistence/repos/accounting';
import counterpartyRepos from '@infra/persistence/repos/counterparty';
import ledgerRepos from '@infra/persistence/repos/ledger';
import userRepos from '@infra/persistence/repos/user';
import appContext from '@infra/services/app-context.service';

export const setCurrentAccountingPeriodUseCase = makeTracedUseCase(
  'accounting.setCurrentAccountingPeriodUseCase',
  makeSetCurrentAccountingPeriodUsecase({
    appContext,
    accountingContextService,
    accountingContextRepo: accountingRepos.accountingContext,
    eventBus: messaging.eventBus,
  })
);

export const getNextCurrentAccountingPeriodUseCase = makeTracedUseCase(
  'accounting.getNextCurrentAccountingPeriodUseCase',
  makeGetNextCurrentAccountingPeriodUsecase({
    appContext,
    nextCurrentAccountingPeriodQueryRepo:
      accountingRepos.nextCurrentAccountingPeriodQuery,
  })
);

export const setCurrentReportingPeriodUseCase = makeTracedUseCase(
  'accounting.setCurrentReportingPeriodUseCase',
  makeSetCurrentReportingPeriodUsecase({
    appContext,
    reportingContextService,
    reportingContextRepo: accountingRepos.reportingContext,
    eventBus: messaging.eventBus,
  })
);

export const getNextCurrentReportingPeriodUseCase = makeTracedUseCase(
  'accounting.getNextCurrentReportingPeriodUseCase',
  makeGetNextCurrentReportingPeriodUsecase({
    appContext,
    nextCurrentReportingPeriodQueryRepo:
      accountingRepos.nextCurrentReportingPeriodQuery,
  })
);

export const createReportingContextUseCase = makeTracedUseCase(
  'accounting.createReportingContextUseCase',
  makeCreateReportingContextUsecase({
    appContext,
    reportingContextService,
    accountingContextRepo: accountingRepos.accountingContext,
    reportingIntervalRepo: accountingRepos.reportingInterval,
    reportingContextRepo: accountingRepos.reportingContext,
    eventBus: messaging.eventBus,
  })
);

export const createReportingPeriodsUseCase = makeTracedUseCase(
  'accounting.createReportingPeriodsUseCase',
  makeCreateReportingPeriodsUsecase({
    appContext,
    fiscalYearRepo: accountingRepos.fiscalYear,
    reportingPeriodService,
    reportingPeriodRepo: accountingRepos.reportingPeriod,
    eventBus: messaging.eventBus,
  })
);

export const createAccountingContextUseCase = makeTracedUseCase(
  'accounting.createAccountingContextUseCase',
  makeCreateAccountingContextUsecase({
    appContext,
    accountingContextService,
    fiscalYearRepo: accountingRepos.fiscalYear,
    accountingIntervalRepo: accountingRepos.accountingInterval,
    accountingContextRepo: accountingRepos.accountingContext,
    eventBus: messaging.eventBus,
  })
);

export const createAccountingPeriodsUseCase = makeTracedUseCase(
  'accounting.createAccountingPeriodsUseCase',
  makeCreateAccountingPeriodsUsecase({
    appContext,
    fiscalYearRepo: accountingRepos.fiscalYear,
    accountingPeriodService,
    accountingPeriodRepo: accountingRepos.accountingPeriod,
    eventBus: messaging.eventBus,
  })
);

export const createFiscalYearUseCase = makeTracedUseCase(
  'accounting.createFiscalYearUseCase',
  makeCreateFiscalYearUsecase({
    appContext,
    fiscalYearRepo: accountingRepos.fiscalYear,
    fiscalYearService,
    eventBus: messaging.eventBus,
  })
);

export const createAccountingEntityUseCase = makeTracedUseCase(
  'accounting.createAccountingEntityUseCase',
  makeCreateAccountingEntityUseCase({
    appContext,
    accountingEntityRepo: accountingRepos.accountingEntity,
    accountingEntityService,
    eventBus: messaging.eventBus,
  })
);

export const getJurisdictionsUseCase = makeTracedUseCase(
  'accounting.getJurisdictionsUseCase',
  makeGetJurisdictionsUseCase()
);

export const getAccountingContextUseCase = makeTracedUseCase(
  'accounting.getAccountingContextUseCase',
  makeGetAccountingContextUsecase({
    appContext,
    fiscalYearRepo: accountingRepos.fiscalYear,
    accountingContextRepo: accountingRepos.accountingContext,
  })
);

export const getReportingContextUseCase = makeTracedUseCase(
  'accounting.getReportingContextUseCase',
  makeGetReportingContextUsecase({
    appContext,
    reportingContextRepo: accountingRepos.reportingContext,
    fiscalYearRepo: accountingRepos.fiscalYear,
  })
);

export const getFiscalYearsUseCase = makeTracedUseCase(
  'accounting.getFiscalYearsUseCase',
  makeGetFiscalYearsUsecase({
    appContext,
    fiscalYearRepo: accountingRepos.fiscalYear,
  })
);

export const getFiscalYearUseCase = makeTracedUseCase(
  'accounting.getFiscalYearUseCase',
  makeGetFiscalYearUsecase({
    appContext,
    fiscalYearRepo: accountingRepos.fiscalYear,
  })
);

export const getUserAccountingEntitiesUseCase = makeTracedUseCase(
  'accounting.getUserAccountingEntitiesUseCase',
  makeGetUserAccountingEntitiesUseCase({
    appContext,
    accountingEntityRepo: accountingRepos.accountingEntity,
  })
);

export const getActiveAccountingEntityUseCase = makeTracedUseCase(
  'accounting.getActiveAccountingEntityUseCase',
  makeGetCurrentAccountingEntityUseCase({
    appContext,
    accountingEntityRepo: accountingRepos.accountingEntity,
    userPreferencesRepo: userRepos.userPreferences,
  })
);

export const switchAccountingEntityUseCase = makeTracedUseCase(
  'accounting.switchAccountingEntityUseCase',
  makeSwitchAccountingEntityUsecase({
    appContext,
    accountingEntityRepo: accountingRepos.accountingEntity,
    userPreferencesAppService,
  })
);

export const updateAccountingEntityUseCase = makeTracedUseCase(
  'accounting.updateAccountingEntityUseCase',
  makeUpdateAccountingEntityUsecase({
    appContext,
    accountingEntityRepo: accountingRepos.accountingEntity,
    accountingEntityService,
    ledgerAccountBalanceRepo: ledgerRepos.ledgerAccountBalance,
    repoService,
    eventBus: messaging.eventBus,
  })
);

export const deleteAccountingEntityUseCase = makeTracedUseCase(
  'accounting.deleteAccountingEntityUseCase',
  makeDeleteAccountingEntityUsecase({
    appContext,
    accountingEntityRepo: accountingRepos.accountingEntity,
    accountingContextRepo: accountingRepos.accountingContext,
    reportingContextRepo: accountingRepos.reportingContext,
    counterpartyRepo: counterpartyRepos.counterparty,
    userPreferencesRepo: userRepos.userPreferences,
    accountingEntityService,
    repoService,
    eventBus: messaging.eventBus,
  })
);

export const archiveAccountingEntityUseCase = makeTracedUseCase(
  'accounting.archiveAccountingEntityUseCase',
  makeArchiveAccountingEntityUsecase({
    appContext,
    accountingEntityRepo: accountingRepos.accountingEntity,
    userPreferencesRepo: userRepos.userPreferences,
    repoService,
    eventBus: messaging.eventBus,
  })
);

export const getAccountingPeriodUseCase = makeTracedUseCase(
  'accounting.getAccountingPeriodUseCase',
  makeGetAccountingPeriodUsecase({
    appContext,
    accountingPeriodRepo: accountingRepos.accountingPeriod,
  })
);

export const getAccountingPeriodsUseCase = makeTracedUseCase(
  'accounting.getAccountingPeriodsUseCase',
  makeGetAccountingPeriodsUsecase({
    appContext,
    fiscalYearRepo: accountingRepos.fiscalYear,
    accountingPeriodRepo: accountingRepos.accountingPeriod,
  })
);

export const getReportingPeriodsUseCase = makeTracedUseCase(
  'accounting.getReportingPeriodsUseCase',
  makeGetReportingPeriodsUsecase({
    appContext,
    fiscalYearRepo: accountingRepos.fiscalYear,
    reportingPeriodRepo: accountingRepos.reportingPeriod,
  })
);
