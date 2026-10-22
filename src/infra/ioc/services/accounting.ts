import makeAccountingContextService from '@domain/accounting/services/accounting-context.service';
import makeAccountingEntityService from '@domain/accounting/services/accounting-entity.service';
import makeAccountingIntervalService from '@domain/accounting/services/accounting-interval.service';
import makeAccountingPeriodService from '@domain/accounting/services/accounting-period.service';
import makeFiscalYearService from '@domain/accounting/services/fiscal-year.service';
import makeReportingContextService from '@domain/accounting/services/reporting-context.service';
import makeReportingPeriodService from '@domain/accounting/services/reporting-period.service';

import accountingRepos from '@infra/persistence/repos/accounting';
import journalEntryRepos from '@infra/persistence/repos/journal-entry';
import ledgerRepos from '@infra/persistence/repos/ledger';

export const reportingContextService = makeReportingContextService({
  reportingContextRepo: accountingRepos.reportingContext,
  accountingContextRepo: accountingRepos.accountingContext,
  reportingPeriodRepo: accountingRepos.reportingPeriod,
});

export const accountingContextService = makeAccountingContextService({
  accountingContextRepo: accountingRepos.accountingContext,
  accountingPeriodRepo: accountingRepos.accountingPeriod,
  fiscalYearRepo: accountingRepos.fiscalYear,
});

export const reportingPeriodService = makeReportingPeriodService({
  reportingPeriodRepo: accountingRepos.reportingPeriod,
});

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

export const accountingIntervalService = makeAccountingIntervalService({
  accountingIntervalRepo: accountingRepos.accountingInterval,
});
