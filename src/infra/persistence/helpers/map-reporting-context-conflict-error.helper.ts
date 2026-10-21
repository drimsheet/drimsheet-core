import accountingError from '@domain/accounting/errors/accounting.error';

/** Maps only the accounting-context uniqueness violation, including wrapped causes. */
export default function mapReportingContextConflictErrorHelper(
  error: unknown
): unknown {
  let current = error;
  const visited = new Set<object>();
  while (typeof current === 'object' && current !== null) {
    if (visited.has(current)) {
      break;
    }
    visited.add(current);
    const isDuplicateContext =
      'code' in current &&
      current.code === '23505' &&
      'constraint' in current &&
      current.constraint === 'reporting_contexts_accounting_context_id_key';
    if (isDuplicateContext) {
      return new accountingError.ReportingContextAlreadyExists();
    }
    current = 'cause' in current ? current.cause : undefined;
  }
  return error;
}
