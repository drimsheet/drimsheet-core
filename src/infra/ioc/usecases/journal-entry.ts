import makeArchiveJournalEntryUsecase from '@app/journal-entry/usecases/archive-journal-entry.usecase';
import makeCreateOpeningBalanceUseCase from '@app/journal-entry/usecases/create-opening-balance.usecase';
import makeCreatePaymentUsecase from '@app/journal-entry/usecases/create-payment.usecase';
import makeCreateReceiptUsecase from '@app/journal-entry/usecases/create-receipt.usecase';
import makeCreateTransferUsecase from '@app/journal-entry/usecases/create-transfer.usecase';
import makeDeleteJournalEntryUsecase from '@app/journal-entry/usecases/delete-journal-entry.usecase';
import makeGetJournalEntriesUsecase from '@app/journal-entry/usecases/get-journal-entries.usecase';
import makeGetJournalEntryUsecase from '@app/journal-entry/usecases/get-journal-entry.usecase';
import makeRectifyJournalEntryUsecase from '@app/journal-entry/usecases/rectify-journal-entry.usecase';

import { counterpartyAppService } from '@infra/ioc/services/counterparty';
import { fileManagementAppService } from '@infra/ioc/services/file';
import {
  fxCostBasisPersistenceAppService,
  fxLotAppService,
} from '@infra/ioc/services/fx-lot-cost-basis';
import {
  journalEntryPersistenceAppService,
  journalEntryRectificationPreparationAppService,
  journalEntryRemovalService,
  journalEntryService,
  openingBalanceEntryAppService,
} from '@infra/ioc/services/journal-entry';
import outboxAppService from '@infra/ioc/services/outbox';
import { repoService } from '@infra/ioc/services/repo';
import messaging from '@infra/messaging';
import { makeTracedUseCase } from '@infra/observability/usecase-tracing';
import counterpartyRepos from '@infra/persistence/repos/counterparty';
import journalEntryRepos from '@infra/persistence/repos/journal-entry';
import ledgerRepos from '@infra/persistence/repos/ledger';
import appContext from '@infra/runtime/app-context';

export const createOpeningBalanceUseCase = makeTracedUseCase(
  'journalEntry.createOpeningBalanceUseCase',
  makeCreateOpeningBalanceUseCase({
    appContext,
    ledgerAccountRepo: ledgerRepos.ledgerAccount,
    eventBus: messaging.eventBus,
    openingBalanceEntryAppService,
    journalEntryPersistenceAppService,
    outboxAppService,
    ledgerBalanceAdjustmentQueue: messaging.queues.ledgerBalanceAdjustment,
    repoService,
    fxCostBasisPersistenceAppService,
  })
);

export const getJournalEntryUseCase = makeTracedUseCase(
  'journalEntry.getJournalEntryUseCase',
  makeGetJournalEntryUsecase({
    appContext,
    journalEntryQueryRepo: journalEntryRepos.queries.journalEntry,
  })
);

export const archiveJournalEntryUseCase = makeTracedUseCase(
  'journalEntry.archiveJournalEntryUseCase',
  makeArchiveJournalEntryUsecase({
    appContext,
    eventBus: messaging.eventBus,
    journalEntryRepo: journalEntryRepos.journalEntry,
  })
);

export const deleteJournalEntryUseCase = makeTracedUseCase(
  'journalEntry.deleteJournalEntryUseCase',
  makeDeleteJournalEntryUsecase({
    appContext,
    eventBus: messaging.eventBus,
    fxCostBasisPersistenceAppService,
    fxLotAppService,
    journalEntryPersistenceAppService,
    journalEntryRemovalService,
    journalEntryRepo: journalEntryRepos.journalEntry,
    ledgerBalanceAdjustmentQueue: messaging.queues.ledgerBalanceAdjustment,
    outboxAppService,
    repoService,
  })
);

export const getJournalEntriesUseCase = makeTracedUseCase(
  'journalEntry.getJournalEntriesUseCase',
  makeGetJournalEntriesUsecase({
    appContext,
    journalEntryQueryRepo: journalEntryRepos.queries.journalEntry,
  })
);

export const createPaymentUseCase = makeTracedUseCase(
  'journalEntry.createPaymentUseCase',
  makeCreatePaymentUsecase({
    counterpartyRepo: counterpartyRepos.counterparty,
    appContext,
    counterpartyAppService,
    fileManagementAppService,
    journalEntryService,
    ledgerAccountRepo: ledgerRepos.ledgerAccount,
    journalEntryPersistenceAppService,
    repoService,
    eventBus: messaging.eventBus,
    outboxAppService,
    ledgerBalanceAdjustmentQueue: messaging.queues.ledgerBalanceAdjustment,
    fxLotAppService,
    fxCostBasisPersistenceAppService,
  })
);

export const createReceiptUseCase = makeTracedUseCase(
  'journalEntry.createReceiptUseCase',
  makeCreateReceiptUsecase({
    counterpartyRepo: counterpartyRepos.counterparty,
    appContext,
    counterpartyAppService,
    fileManagementAppService,
    journalEntryService,
    ledgerAccountRepo: ledgerRepos.ledgerAccount,
    journalEntryPersistenceAppService,
    repoService,
    eventBus: messaging.eventBus,
    outboxAppService,
    ledgerBalanceAdjustmentQueue: messaging.queues.ledgerBalanceAdjustment,
    fxLotAppService,
    fxCostBasisPersistenceAppService,
  })
);

export const createTransferUseCase = makeTracedUseCase(
  'journalEntry.createTransferUseCase',
  makeCreateTransferUsecase({
    counterpartyRepo: counterpartyRepos.counterparty,
    appContext,
    counterpartyAppService,
    fileManagementAppService,
    journalEntryService,
    ledgerAccountRepo: ledgerRepos.ledgerAccount,
    journalEntryPersistenceAppService,
    repoService,
    eventBus: messaging.eventBus,
    outboxAppService,
    ledgerBalanceAdjustmentQueue: messaging.queues.ledgerBalanceAdjustment,
    fxLotAppService,
    fxCostBasisPersistenceAppService,
  })
);

export const rectifyJournalEntryUseCase = makeTracedUseCase(
  'journalEntry.rectifyJournalEntryUseCase',
  makeRectifyJournalEntryUsecase({
    counterpartyRepo: counterpartyRepos.counterparty,
    appContext,
    journalEntryRepo: journalEntryRepos.journalEntry,
    journalEntryRectificationPreparationAppService,
    journalEntryPersistenceAppService,
    repoService,
    eventBus: messaging.eventBus,
    outboxAppService,
    ledgerBalanceAdjustmentQueue: messaging.queues.ledgerBalanceAdjustment,
    fxCostBasisPersistenceAppService,
  })
);
