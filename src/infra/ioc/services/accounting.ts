import makeAccountingEntityService from '@domain/accounting/services/accounting-entity.service';
import makeAccountingPeriodService from '@domain/accounting/services/accounting-period.service';
import makeFiscalYearService from '@domain/accounting/services/fiscal-year.service';

import accountingRepos from '@infra/persistence/repos/accounting';
import journalEntryRepos from '@infra/persistence/repos/journal-entry';
import ledgerRepos from '@infra/persistence/repos/ledger';

export const fiscalYearService = makeFiscalYearService({
  fiscalYearRepo: accountingRepos.fiscalYear,
});

export const accountingPeriodService = makeAccountingPeriodService({
  accountingPeriodRepo: accountingRepos.accountingPeriod,
});

export const accountingEntityService = makeAccountingEntityService({
  accountingEntityRepo: accountingRepos.accountingEntity,
  ledgerAccountBalanceRepo: ledgerRepos.ledgerAccountBalance,
  journalEntryRepo: journalEntryRepos.journalEntry,
});
