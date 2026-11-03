import makeGetCounterpartyAccountTypeParticipationUsecase from '@app/counterparty/usecases/reporting/participation-by-account-type/participation-by-account-type.usecase';

import { makeTracedUseCase } from '@infra/observability/usecase-tracing';
import accountingRepos from '@infra/persistence/repos/accounting';
import counterpartyRepos from '@infra/persistence/repos/counterparty';
import counterpartyAccountTypeParticipationRepoQuery from '@infra/persistence/repos/counterparty/queries/participation-by-account-type.reporting';
import appContext from '@infra/services/app-context.service';

export const getCounterpartyAccountTypeParticipationUseCase = makeTracedUseCase(
  'reporting.getCounterpartyAccountTypeParticipationUseCase',
  makeGetCounterpartyAccountTypeParticipationUsecase({
    appContext,
    counterpartyRepo: counterpartyRepos.counterparty,
    fiscalYearRepo: accountingRepos.fiscalYear,
    repoQuery: counterpartyAccountTypeParticipationRepoQuery,
  })
);
