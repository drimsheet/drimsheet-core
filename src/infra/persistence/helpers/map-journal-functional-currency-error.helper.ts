import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';

/** Maps only the journal functional-currency constraints, preserving unrelated database failures. */
export default function mapJournalFunctionalCurrencyErrorHelper(
  error: unknown
): unknown {
  let current = error;
  const visited = new Set<object>();
  while (typeof current === 'object' && current !== null) {
    if (visited.has(current)) {
      break;
    }
    visited.add(current);
    const isCheckViolation = 'code' in current && current.code === '23514';
    const constraint = 'constraint' in current ? current.constraint : undefined;
    if (isCheckViolation) {
      if (constraint === 'journal_lines_entity_functional_currency_check') {
        return new accountingEntityError.FunctionalCurrencyMismatch();
      }
      if (constraint === 'accounting_entities_journal_currency_change_check') {
        return new accountingEntityError.FunctionalCurrencyChangeNotAllowed();
      }
    }
    current = 'cause' in current ? current.cause : undefined;
  }
  return error;
}
