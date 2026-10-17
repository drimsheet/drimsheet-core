import periodError from '@domain/accounting/errors/period.error';

/** Translates only the accounting-period exclusion conflict, including Drizzle cause wrappers. */
export default function mapAccountingPeriodOverlapErrorHelper(
  error: unknown
): unknown {
  let current = error;
  const visited = new Set<object>();
  while (typeof current === 'object' && current !== null) {
    if (visited.has(current)) {
      break;
    }
    visited.add(current);
    const isAccountingPeriodOverlap =
      'code' in current &&
      current.code === '23P01' &&
      'constraint' in current &&
      current.constraint === 'accounting_periods_entity_dates_excl';
    if (isAccountingPeriodOverlap) {
      return new periodError.OverlappingPeriods();
    }
    current = 'cause' in current ? current.cause : undefined;
  }
  return error;
}
