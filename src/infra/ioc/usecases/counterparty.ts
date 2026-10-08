import makeArchiveCounterpartyUsecase from '@app/counterparty/usecases/archive-counterparty.usecase';
import makeCreateCounterpartyUsecase from '@app/counterparty/usecases/create-counterparty.usecase';
import makeDeleteCounterpartyUsecase from '@app/counterparty/usecases/delete-counterparty.usecase';
import makeGetCounterpartiesUsecase from '@app/counterparty/usecases/get-counterparties.usecase';
import makeGetCounterpartyDeletionEligibilityUsecase from '@app/counterparty/usecases/get-counterparty-deletion-eligibility.usecase';
import makeGetCounterpartyUsecase from '@app/counterparty/usecases/get-counterparty.usecase';
import makeUpdateCounterpartyUsecase from '@app/counterparty/usecases/update-counterparty.usecase';

import { counterpartyService } from '@infra/ioc/services/counterparty';
import messaging from '@infra/messaging';
import { makeTracedUseCase } from '@infra/observability/usecase-tracing';
import counterpartyRepos from '@infra/persistence/repos/counterparty';
import journalRepos from '@infra/persistence/repos/journal-entry';
import appContext from '@infra/runtime/app-context';
import repoService from '@infra/services/repo.service';

export const archiveCounterpartyUseCase = makeTracedUseCase(
  'counterparty.archiveCounterpartyUseCase',
  makeArchiveCounterpartyUsecase({
    appContext,
    counterpartyRepo: counterpartyRepos.counterparty,
    eventBus: messaging.eventBus,
  })
);

export const createCounterpartyUseCase = makeTracedUseCase(
  'counterparty.createCounterpartyUseCase',
  makeCreateCounterpartyUsecase({
    counterpartyRepo: counterpartyRepos.counterparty,
    appContext,
    counterpartyService,
    eventBus: messaging.eventBus,
  })
);

export const deleteCounterpartyUseCase = makeTracedUseCase(
  'counterparty.deleteCounterpartyUseCase',
  makeDeleteCounterpartyUsecase({
    repoService,
    appContext,
    journalLineRepo: journalRepos.journalLine,
    counterpartyRepo: counterpartyRepos.counterparty,
  })
);

export const getCounterpartiesUseCase = makeTracedUseCase(
  'counterparty.getCounterpartiesUseCase',
  makeGetCounterpartiesUsecase({
    appContext,
    counterpartyRepo: counterpartyRepos.counterparty,
  })
);

export const getCounterpartyDeletionEligibilityUseCase = makeTracedUseCase(
  'counterparty.getCounterpartyDeletionEligibilityUseCase',
  makeGetCounterpartyDeletionEligibilityUsecase({
    appContext,
    counterpartyRepo: counterpartyRepos.counterparty,
    journalEntryQueryRepo: journalRepos.queries.journalEntry,
  })
);

export const getCounterpartyUseCase = makeTracedUseCase(
  'counterparty.getCounterpartyUseCase',
  makeGetCounterpartyUsecase({
    appContext,
    counterpartyRepo: counterpartyRepos.counterparty,
  })
);

export const updateCounterpartyUseCase = makeTracedUseCase(
  'counterparty.updateCounterpartyUseCase',
  makeUpdateCounterpartyUsecase({
    repoService,
    appContext,
    counterpartyService,
    counterpartyRepo: counterpartyRepos.counterparty,
    eventBus: messaging.eventBus,
  })
);
