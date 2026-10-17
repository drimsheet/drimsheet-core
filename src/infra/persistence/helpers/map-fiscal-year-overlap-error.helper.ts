import periodError from '@domain/accounting/errors/period.error';

/** Translates only the fiscal-year exclusion conflict, including Drizzle cause wrappers. */
export default function mapFiscalYearOverlapErrorHelper(
  error: unknown
): unknown {
  let current = error;
  const visited = new Set<object>();
  while (typeof current === 'object' && current !== null) {
    if (visited.has(current)) {
      break;
    }
    visited.add(current);
    const isFiscalYearOverlap =
      'code' in current &&
      current.code === '23P01' &&
      'constraint' in current &&
      current.constraint === 'fiscal_years_entity_dates_excl';
    if (isFiscalYearOverlap) {
      return new periodError.OverlappingFiscalYears();
    }
    current = 'cause' in current ? current.cause : undefined;
  }
  return error;
}
