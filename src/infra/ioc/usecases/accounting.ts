import makeArchiveAccountingEntityUsecase from '@app/accounting/usecases/archive-accounting-entity.usecase';
import makeCreateAccountingEntityUseCase from '@app/accounting/usecases/create-accounting-entity.usecase';
import makeGetCurrentAccountingEntityUseCase from '@app/accounting/usecases/get-active-accounting-entity.usecase';
import makeGetJurisdictionsUseCase from '@app/accounting/usecases/get-jurisdictions.usecase';
import makeGetUserAccountingEntitiesUseCase from '@app/accounting/usecases/get-user-accounting-entities.usecase';
import makeSwitchAccountingEntityUsecase from '@app/accounting/usecases/switch-accounting-entity.usecase';
import makeUpdateAccountingEntityUsecase from '@app/accounting/usecases/update-accounting-entity.usecase';

import { accountingEntityService } from '@infra/ioc/services/accounting';
import { repoService } from '@infra/ioc/services/repo';
import { userPreferencesAppService } from '@infra/ioc/services/user';
import messaging from '@infra/messaging';
import { makeTracedUseCase } from '@infra/observability/usecase-tracing';
import accountingRepos from '@infra/persistence/repos/accounting';
import ledgerRepos from '@infra/persistence/repos/ledger';
import userRepos from '@infra/persistence/repos/user';
import appContext from '@infra/runtime/app-context';

export const createAccountingEntityUseCase = makeTracedUseCase(
  'accounting.createAccountingEntityUseCase',
  makeCreateAccountingEntityUseCase({
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
    eventBus: messaging.eventBus,
  })
);

export const getJurisdictionsUseCase = makeTracedUseCase(
  'accounting.getJurisdictionsUseCase',
  makeGetJurisdictionsUseCase()
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
