import makeJournalEntryRectificationService from '@domain/journal-entry/services/journal-entry-rectification.service';
import makeJournalEntryRemovalService from '@domain/journal-entry/services/journal-entry-removal.service';
import makeJournalEntryService from '@domain/journal-entry/services/journal-entry.service';

import makeJournalEntryPersistenceAppService from '@app/journal-entry/services/journal-entry-persistence.service';
import makeJournalEntryRectificationPreparationAppService from '@app/journal-entry/services/journal-entry-rectification-preparation.service';
import makeOpeningBalanceEntryAppService from '@app/journal-entry/services/opening-balance-entry.service';

import counterpartyRepos from '@infra/persistence/repos/counterparty';
import journalEntryRepos from '@infra/persistence/repos/journal-entry';
import ledgerRepos from '@infra/persistence/repos/ledger';

import { accountingPeriodService } from './accounting';
import { fxLotAppService } from './fx-lot-cost-basis';
import { repoService } from './repo';

export const journalEntryService = makeJournalEntryService({
  ledgerAccountRepo: ledgerRepos.ledgerAccount,
  accountingPeriodService,
  ledgerAccountBalanceRepo: ledgerRepos.ledgerAccountBalance,
});

export const journalEntryRectificationService =
  makeJournalEntryRectificationService({
    accountingPeriodService,
    ledgerAccountRepo: ledgerRepos.ledgerAccount,
  });

export const journalEntryRemovalService = makeJournalEntryRemovalService({
  journalEntryRectificationService,
});

export const journalEntryRectificationPreparationAppService =
  makeJournalEntryRectificationPreparationAppService({
    counterpartyRepo: counterpartyRepos.counterparty,
    journalEntryService,
    journalEntryRectificationService,
    ledgerAccountRepo: ledgerRepos.ledgerAccount,
    fxLotAppService,
  });

export const openingBalanceEntryAppService = makeOpeningBalanceEntryAppService({
  journalEntryQueryRepo: journalEntryRepos.queries.journalEntry,
  accountingPeriodService,
  ledgerAccountBalanceRepo: ledgerRepos.ledgerAccountBalance,
  ledgerAccountRepo: ledgerRepos.ledgerAccount,
  fxLotAppService,
});

export const journalEntryPersistenceAppService =
  makeJournalEntryPersistenceAppService({
    ledgerAccountRepo: ledgerRepos.ledgerAccount,
    repoService,
    journalEntryAttachmentRepo: journalEntryRepos.journalEntryAttachment,
    journalEntryHistoryRepo: journalEntryRepos.journalEntryHistory,
    journalEntryRepo: journalEntryRepos.journalEntry,
    journalLineHistoryRepo: journalEntryRepos.journalLineHistory,
    journalLineRepo: journalEntryRepos.journalLine,
  });
