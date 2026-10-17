import periodError from '@domain/accounting/errors/period.error';

/** Translates only the reporting-period uniqueness conflict, including Drizzle cause wrappers. */
export default function mapReportingPeriodDuplicateErrorHelper(
  error: unknown
): unknown {
  let current = error;
  const visited = new Set<object>();
  while (typeof current === 'object' && current !== null) {
    if (visited.has(current)) {
      break;
    }
    visited.add(current);
    const isReportingPeriodDuplicate =
      'code' in current &&
      current.code === '23505' &&
      'constraint' in current &&
      current.constraint === 'reporting_periods_fiscal_year_start_date_key';
    if (isReportingPeriodDuplicate) {
      return new periodError.DuplicateReportingPeriods();
    }
    current = 'cause' in current ? current.cause : undefined;
  }
  return error;
}
