import makeJournalEntryService from '@domain/journal-entry/services/journal-entry.service';
import makeOpeningBalanceEntryService from '@domain/journal-entry/services/opening-balance-entry.service';
import makePaymentEntryService from '@domain/journal-entry/services/payment-entry.service';
import makeReceiptEntryService from '@domain/journal-entry/services/receipt-entry.service';
import makeTransferEntryService from '@domain/journal-entry/services/transfer-entry.service';

import makeJournalEntryPersistenceAppService from '@app/journal-entry/services/journal-entry-persistence.service';

import counterpartyRepos from '@infra/persistence/repos/counterparty';
import journalEntryRepos from '@infra/persistence/repos/journal-entry';
import ledgerRepos from '@infra/persistence/repos/ledger';

import { accountingPeriodService } from './accounting';
import { repoService } from './repo';

export const journalEntryService = makeJournalEntryService({
  accountingPeriodService,
  ledgerAccountRepo: ledgerRepos.ledgerAccount,
});

export const openingBalanceEntryService = makeOpeningBalanceEntryService({
  journalEntryRepo: journalEntryRepos.journalEntry,
  journalEntryService,
  ledgerAccountRepo: ledgerRepos.ledgerAccount,
  accountingPeriodService,
});

export const paymentEntryService = makePaymentEntryService({
  accountingPeriodService,
  counterpartyRepo: counterpartyRepos.counterparty,
  journalEntryService,
  ledgerAccountBalanceRepo: ledgerRepos.ledgerAccountBalance,
  ledgerAccountRepo: ledgerRepos.ledgerAccount,
});

export const receiptEntryService = makeReceiptEntryService({
  accountingPeriodService,
  counterpartyRepo: counterpartyRepos.counterparty,
  journalEntryService,
  ledgerAccountRepo: ledgerRepos.ledgerAccount,
});

export const transferEntryService = makeTransferEntryService({
  accountingPeriodService,
  counterpartyRepo: counterpartyRepos.counterparty,
  journalEntryService,
  ledgerAccountBalanceRepo: ledgerRepos.ledgerAccountBalance,
  ledgerAccountRepo: ledgerRepos.ledgerAccount,
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
