import makeJournalEntryRectificationService from '@domain/journal-entry/services/journal-entry-rectification.service';
import makeJournalEntryRemovalService from '@domain/journal-entry/services/journal-entry-removal.service';
import makeJournalEntryService from '@domain/journal-entry/services/journal-entry.service';

import makeJournalEntryPersistenceService from '@app/journal-entry/services/journal-entry-persistence.service';
import makeJournalEntryRectificationPreparationService from '@app/journal-entry/services/journal-entry-rectification-preparation.service';

import journalEntryRepos from '@infra/persistence/repos/journal-entry';
import ledgerRepos from '@infra/persistence/repos/ledger';

import { accountingPeriodService } from './accounting';
import { counterpartyAppService } from './counterparty';
import { fxLotAppService } from './fx-lot-cost-basis';
import { repoService } from './repo';

export const journalEntryService = makeJournalEntryService({
  accountingPeriodService,
  ledgerAccountBalanceRepo: ledgerRepos.ledgerAccountBalance,
  ledgerAccountRepo: ledgerRepos.ledgerAccount,
});

export const journalEntryRectificationService =
  makeJournalEntryRectificationService({
    ledgerAccountRepo: ledgerRepos.ledgerAccount,
  });

export const journalEntryRemovalService = makeJournalEntryRemovalService({
  journalEntryRectificationService,
});

export const journalEntryRectificationPreparationService =
  makeJournalEntryRectificationPreparationService({
    counterpartyAppService,
    journalEntryService,
    journalEntryRectificationService,
    ledgerAccountRepo: ledgerRepos.ledgerAccount,
    fxLotAppService,
  });

export const journalEntryPersistenceService =
  makeJournalEntryPersistenceService({
    repoService,
    journalEntryAttachmentRepo: journalEntryRepos.journalEntryAttachment,
    journalEntryHistoryRepo: journalEntryRepos.journalEntryHistory,
    journalEntryRepo: journalEntryRepos.journalEntry,
    journalLineHistoryRepo: journalEntryRepos.journalLineHistory,
    journalLineRepo: journalEntryRepos.journalLine,
  });
