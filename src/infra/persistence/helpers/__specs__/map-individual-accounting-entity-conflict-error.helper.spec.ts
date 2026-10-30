import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';

import mapIndividualAccountingEntityConflictErrorHelper from '@infra/persistence/helpers/map-individual-accounting-entity-conflict-error.helper';

describe('mapIndividualAccountingEntityConflictErrorHelper', () => {
  const conflict = {
    code: '23505',
    constraint: 'accounting_entities_unique_individual_owner_jurisdiction_idx',
  };
  it.each([conflict, { cause: conflict }, { cause: { cause: conflict } }])(
    'maps the individual owner/jurisdiction uniqueness violation: %j',
    (error) => {
      expect(
        mapIndividualAccountingEntityConflictErrorHelper(error)
      ).toBeInstanceOf(
        accountingEntityError.IndividualAccountingEntityAlreadyExistsInJurisdiction
      );
    }
  );
  it.each([
    null,
    undefined,
    'failure',
    {},
    { code: '23P01', constraint: conflict.constraint },
    { code: '23505', constraint: 'other' },
    { code: '23505' },
    { cause: {} },
  ])('preserves unrelated failures: %j', (error) => {
    expect(mapIndividualAccountingEntityConflictErrorHelper(error)).toBe(error);
  });
  it('terminates on cyclic error causes', () => {
    const error: { cause?: unknown } = {};
    error.cause = error;
    expect(mapIndividualAccountingEntityConflictErrorHelper(error)).toBe(error);
  });
});
