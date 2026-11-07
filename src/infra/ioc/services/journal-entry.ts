import makeJournalEntryRectificationService from '@domain/journal-entry/services/journal-entry-rectification.service';
import makeJournalEntryRemovalService from '@domain/journal-entry/services/journal-entry-removal.service';
import makeOpeningBalanceEntryService from '@domain/journal-entry/services/opening-balance-entry.service';
import makePaymentEntryService from '@domain/journal-entry/services/payment-entry.service';
import makeReceiptEntryService from '@domain/journal-entry/services/receipt-entry.service';
import makeTransferEntryService from '@domain/journal-entry/services/transfer-entry.service';

import makeJournalEntryPersistenceAppService from '@app/journal-entry/services/journal-entry-persistence.service';
import makeJournalEntryRectificationPreparationAppService from '@app/journal-entry/services/journal-entry-rectification-preparation.service';

import counterpartyRepos from '@infra/persistence/repos/counterparty';
import journalEntryRepos from '@infra/persistence/repos/journal-entry';
import ledgerRepos from '@infra/persistence/repos/ledger';

import { accountingPeriodService } from './accounting';
import { fxLotAppService } from './fx-lot-cost-basis';
import { repoService } from './repo';

export const openingBalanceEntryService = makeOpeningBalanceEntryService({
  journalEntryRepo: journalEntryRepos.journalEntry,
  ledgerAccountBalanceRepo: ledgerRepos.ledgerAccountBalance,
  ledgerAccountRepo: ledgerRepos.ledgerAccount,
  accountingPeriodService,
});

export const paymentEntryService = makePaymentEntryService({
  accountingPeriodService,
  ledgerAccountBalanceRepo: ledgerRepos.ledgerAccountBalance,
});

export const receiptEntryService = makeReceiptEntryService({
  accountingPeriodService,
});

export const transferEntryService = makeTransferEntryService({
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
    paymentEntryService,
    receiptEntryService,
    transferEntryService,
    journalEntryRectificationService,
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
