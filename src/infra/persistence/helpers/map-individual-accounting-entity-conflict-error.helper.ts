import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';

/**
 * Maps only the individual owner/jurisdiction uniqueness violation, including
 * wrapped causes. Preserves unrelated failures.
 */
export default function mapIndividualAccountingEntityConflictErrorHelper(
  error: unknown
): unknown {
  let current = error;
  const visited = new Set<object>();
  while (typeof current === 'object' && current !== null) {
    if (visited.has(current)) {
      break;
    }
    visited.add(current);
    const isDuplicateIndividual =
      'code' in current &&
      current.code === '23505' &&
      'constraint' in current &&
      current.constraint ===
        'accounting_entities_unique_individual_owner_jurisdiction_idx';
    if (isDuplicateIndividual) {
      return new accountingEntityError.IndividualAccountingEntityAlreadyExistsInJurisdiction();
    }
    current = 'cause' in current ? current.cause : undefined;
  }
  return error;
}
