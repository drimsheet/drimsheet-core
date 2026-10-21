import accountingError from '@domain/accounting/errors/accounting.error';

/** Maps only the fiscal-year uniqueness violation, including wrapped causes. */
export default function mapAccountingContextConflictErrorHelper(
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
      current.constraint === 'accounting_contexts_fiscal_year_id_key';
    if (isDuplicateContext) {
      return new accountingError.AccountingContextAlreadyExists();
    }
    current = 'cause' in current ? current.cause : undefined;
  }
  return error;
}
