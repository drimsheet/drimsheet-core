import { auditSchema } from './schemas';

export const accountingStandardsTable = {
  name: 'accounting_standards',
  schema: 'core',
};

export const jurisdictionsTable = {
  name: 'jurisdictions',
  schema: 'core',
};

export const jurisdictionAccountingStandardsTable = {
  name: 'jurisdiction_accounting_standards',
  schema: 'core',
};

export const periodStatus = {
  name: 'period_status',
  schema: 'core',
};

export const fiscalYearsTable = {
  name: 'fiscal_years',
  schema: 'core',
};

export const fiscalYearPeriodUnit = {
  name: 'fiscal_year_period_unit',
  schema: 'core',
};

export const accountingIntervalsTable = {
  name: 'accounting_intervals',
  schema: 'core',
};

export const accountingIntervalUnit = {
  name: 'accounting_interval_unit',
  schema: 'core',
};

export const accountingIntervalHistoryTable = {
  name: 'accounting_interval_history',
  schema: auditSchema,
};

export const accountingPeriodStatus = {
  name: 'accounting_period_status',
  schema: 'core',
};

export const accountingPeriodsTable = {
  name: 'accounting_periods',
  schema: 'core',
};

export const accountingContextsTable = {
  name: 'accounting_contexts',
  schema: 'core',
};

export const reportingIntervalsTable = {
  name: 'reporting_intervals',
  schema: 'core',
};

export const reportingIntervalUnit = {
  name: 'reporting_interval_unit',
  schema: 'core',
};

export const reportingIntervalHistoryTable = {
  name: 'reporting_interval_history',
  schema: auditSchema,
};

export const reportingPeriodsTable = {
  name: 'reporting_periods',
  schema: 'core',
};

export const reportingContextsTable = {
  name: 'reporting_contexts',
  schema: 'core',
};

export const accountingContextHistoryTable = {
  name: 'accounting_context_history',
  schema: auditSchema,
};

export const accountingPeriodHistoryTable = {
  name: 'accounting_period_history',
  schema: auditSchema,
};

export const fiscalYearHistoryTable = {
  name: 'fiscal_year_history',
  schema: auditSchema,
};

export const reportingContextHistoryTable = {
  name: 'reporting_context_history',
  schema: auditSchema,
};

export const reportingPeriodHistoryTable = {
  name: 'reporting_period_history',
  schema: auditSchema,
};
