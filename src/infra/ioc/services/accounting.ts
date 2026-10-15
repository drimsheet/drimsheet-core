import makeAccountingEntityService from '@domain/accounting/services/accounting-entity.service';
import makeAccountingPeriodService from '@domain/accounting/services/accounting-period.service';

import accountingRepos from '@infra/persistence/repos/accounting';
import journalEntryRepos from '@infra/persistence/repos/journal-entry';
import ledgerRepos from '@infra/persistence/repos/ledger';

export const accountingPeriodService = makeAccountingPeriodService({
  accountingPeriodRepo: accountingRepos.accountingPeriod,
});

export const accountingEntityService = makeAccountingEntityService({
  ledgerAccountBalanceRepo: ledgerRepos.ledgerAccountBalance,
  journalEntryRepo: journalEntryRepos.journalEntry,
  accountingEntityRepo: accountingRepos.accountingEntity,
  accountingPeriodService,
});
