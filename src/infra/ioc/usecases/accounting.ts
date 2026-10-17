import makeArchiveAccountingEntityUsecase from '@app/accounting/usecases/archive-accounting-entity.usecase';
import makeCreateAccountingContextUsecase from '@app/accounting/usecases/create-accounting-context.usecase';
import makeCreateAccountingEntityUseCase from '@app/accounting/usecases/create-accounting-entity.usecase';
import makeCreateAccountingPeriodsUsecase from '@app/accounting/usecases/create-accounting-periods.usecase';
import makeCreateFiscalYearUsecase from '@app/accounting/usecases/create-fiscal-year.usecase';
import makeDeleteAccountingEntityUsecase from '@app/accounting/usecases/delete-accounting-entity.usecase';
import makeGetAccountingContextsUsecase from '@app/accounting/usecases/get-accounting-contexts.usecase';
import makeGetCurrentAccountingEntityUseCase from '@app/accounting/usecases/get-active-accounting-entity.usecase';
import makeGetJurisdictionsUseCase from '@app/accounting/usecases/get-jurisdictions.usecase';
import makeGetReportingContextsUsecase from '@app/accounting/usecases/get-reporting-contexts.usecase';
import makeGetUserAccountingEntitiesUseCase from '@app/accounting/usecases/get-user-accounting-entities.usecase';
import makeOnboardAccountingEntityUsecase from '@app/accounting/usecases/onboard-accounting-entity.usecase';
import makeSwitchAccountingEntityUsecase from '@app/accounting/usecases/switch-accounting-entity.usecase';
import makeUpdateAccountingEntityUsecase from '@app/accounting/usecases/update-accounting-entity.usecase';

import {
  accountingContextService,
  accountingEntityService,
  accountingPeriodService,
  fiscalYearService,
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

export const createAccountingContextUseCase = makeTracedUseCase(
  'accounting.createAccountingContextUseCase',
  makeCreateAccountingContextUsecase({
    appContext,
    accountingContextService,
    fiscalYearRepo: accountingRepos.fiscalYear,
    accountingPeriodRepo: accountingRepos.accountingPeriod,
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
    repoService,
    eventBus: messaging.eventBus,
  })
);

export const createFiscalYearUseCase = makeTracedUseCase(
  'accounting.createFiscalYearUseCase',
  makeCreateFiscalYearUsecase({
    appContext,
    accountingEntityRepo: accountingRepos.accountingEntity,
    accountingEntityService,
    fiscalYearRepo: accountingRepos.fiscalYear,
    fiscalYearService,
    repoService,
    eventBus: messaging.eventBus,
  })
);

export const createAccountingEntityUseCase = makeTracedUseCase(
  'accounting.createAccountingEntityUseCase',
  makeCreateAccountingEntityUseCase({
    appContext,
    accountingEntityRepo: accountingRepos.accountingEntity,
    repoService,
    accountingEntityService,
    eventBus: messaging.eventBus,
  })
);

/** @deprecated Legacy combined onboarding; scheduled for removal. */
export const onboardAccountingEntityUseCase = makeTracedUseCase(
  'accounting.onboardAccountingEntityUseCase',
  makeOnboardAccountingEntityUsecase({
    appContext,
    accountingEntityRepo: accountingRepos.accountingEntity,
    userPreferencesAppService,
    fiscalYearRepo: accountingRepos.fiscalYear,
    accountingPeriodRepo: accountingRepos.accountingPeriod,
    accountingContextRepo: accountingRepos.accountingContext,
    reportingPeriodRepo: accountingRepos.reportingPeriod,
    reportingContextRepo: accountingRepos.reportingContext,
    repoService,
    accountingEntityService,
    accountingPeriodService,
    eventBus: messaging.eventBus,
  })
);

export const getJurisdictionsUseCase = makeTracedUseCase(
  'accounting.getJurisdictionsUseCase',
  makeGetJurisdictionsUseCase()
);

export const getAccountingContextsUseCase = makeTracedUseCase(
  'accounting.getAccountingContextsUseCase',
  makeGetAccountingContextsUsecase({
    appContext,
    accountingContextQueryRepo: accountingRepos.accountingContextQuery,
  })
);

export const getReportingContextsUseCase = makeTracedUseCase(
  'accounting.getReportingContextsUseCase',
  makeGetReportingContextsUsecase({
    appContext,
    reportingContextQueryRepo: accountingRepos.reportingContextQuery,
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
