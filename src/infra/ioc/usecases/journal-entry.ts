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
import { fileManagementService } from '@infra/ioc/services/file';
import {
  fxCostBasisPersistenceService,
  fxLotAppService,
} from '@infra/ioc/services/fx-lot-cost-basis';
import {
  journalEntryPersistenceService,
  journalEntryRectificationPreparationService,
  journalEntryRemovalService,
  journalEntryService,
} from '@infra/ioc/services/journal-entry';
import outboxService from '@infra/ioc/services/outbox';
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
    journalEntryService,
    journalEntryPersistenceService,
    outboxService,
    ledgerBalanceAdjustmentQueue: messaging.queues.ledgerBalanceAdjustment,
    repoService,
    fxLotAppService,
    fxCostBasisPersistenceService,
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
    fxCostBasisPersistenceService,
    fxLotAppService,
    journalEntryPersistenceService,
    journalEntryRemovalService,
    journalEntryRepo: journalEntryRepos.journalEntry,
    ledgerBalanceAdjustmentQueue: messaging.queues.ledgerBalanceAdjustment,
    outboxService,
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
    fileManagementService,
    journalEntryService,
    ledgerAccountRepo: ledgerRepos.ledgerAccount,
    journalEntryPersistenceService,
    repoService,
    eventBus: messaging.eventBus,
    outboxService,
    ledgerBalanceAdjustmentQueue: messaging.queues.ledgerBalanceAdjustment,
    fxLotAppService,
    fxCostBasisPersistenceService,
  })
);

export const createReceiptUseCase = makeTracedUseCase(
  'journalEntry.createReceiptUseCase',
  makeCreateReceiptUsecase({
    counterpartyRepo: counterpartyRepos.counterparty,
    appContext,
    counterpartyAppService,
    fileManagementService,
    journalEntryService,
    ledgerAccountRepo: ledgerRepos.ledgerAccount,
    journalEntryPersistenceService,
    repoService,
    eventBus: messaging.eventBus,
    outboxService,
    ledgerBalanceAdjustmentQueue: messaging.queues.ledgerBalanceAdjustment,
    fxLotAppService,
    fxCostBasisPersistenceService,
  })
);

export const createTransferUseCase = makeTracedUseCase(
  'journalEntry.createTransferUseCase',
  makeCreateTransferUsecase({
    counterpartyRepo: counterpartyRepos.counterparty,
    appContext,
    counterpartyAppService,
    fileManagementService,
    journalEntryService,
    ledgerAccountRepo: ledgerRepos.ledgerAccount,
    journalEntryPersistenceService,
    repoService,
    eventBus: messaging.eventBus,
    outboxService,
    ledgerBalanceAdjustmentQueue: messaging.queues.ledgerBalanceAdjustment,
    fxLotAppService,
    fxCostBasisPersistenceService,
  })
);

export const rectifyJournalEntryUseCase = makeTracedUseCase(
  'journalEntry.rectifyJournalEntryUseCase',
  makeRectifyJournalEntryUsecase({
    counterpartyRepo: counterpartyRepos.counterparty,
    appContext,
    journalEntryRepo: journalEntryRepos.journalEntry,
    journalEntryRectificationPreparationService,
    journalEntryPersistenceService,
    repoService,
    eventBus: messaging.eventBus,
    outboxService,
    ledgerBalanceAdjustmentQueue: messaging.queues.ledgerBalanceAdjustment,
    fxCostBasisPersistenceService,
  })
);
