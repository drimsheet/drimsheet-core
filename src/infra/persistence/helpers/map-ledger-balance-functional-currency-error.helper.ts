import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';

/** Translates only the balance currency trigger's rejection, including Drizzle cause wrappers. */
export default function mapLedgerBalanceFunctionalCurrencyErrorHelper(
  error: unknown
): unknown {
  let current = error;
  const visited = new Set<object>();
  while (typeof current === 'object' && current !== null) {
    if (visited.has(current)) {
      break;
    }
    visited.add(current);
    const isCurrencyConflict =
      'code' in current &&
      current.code === '23514' &&
      'constraint' in current &&
      current.constraint ===
        'ledger_account_balances_entity_functional_currency_check';
    if (isCurrencyConflict) {
      return new accountingEntityError.FunctionalCurrencyMismatch();
    }
    current = 'cause' in current ? current.cause : undefined;
  }
  return error;
}
