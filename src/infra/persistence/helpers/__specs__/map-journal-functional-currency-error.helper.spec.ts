import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';

import mapJournalFunctionalCurrencyErrorHelper from '@infra/persistence/helpers/map-journal-functional-currency-error.helper';

describe('mapJournalFunctionalCurrencyErrorHelper', () => {
  it.each([
    [
      'journal_lines_entity_functional_currency_check',
      accountingEntityError.FunctionalCurrencyMismatch,
    ],
    [
      'accounting_entities_journal_currency_change_check',
      accountingEntityError.FunctionalCurrencyChangeNotAllowed,
    ],
  ] as const)(
    'maps %s directly and through Drizzle cause wrappers',
    (constraint, ErrorType) => {
      const error = { code: '23514', constraint };
      expect(mapJournalFunctionalCurrencyErrorHelper(error)).toBeInstanceOf(
        ErrorType
      );
      expect(
        mapJournalFunctionalCurrencyErrorHelper({ cause: { cause: error } })
      ).toBeInstanceOf(ErrorType);
    }
  );

  it.each([
    null,
    undefined,
    'failure',
    42,
    new Error('database down'),
    { code: '23514' },
    { code: '23514', constraint: 'other' },
    {
      code: '23505',
      constraint: 'journal_lines_entity_functional_currency_check',
    },
    { cause: { code: '23514', constraint: 'other' } },
  ])('preserves unrelated failures: %p', (error) => {
    expect(mapJournalFunctionalCurrencyErrorHelper(error)).toBe(error);
  });

  it('preserves cyclic error chains without looping', () => {
    const error: { cause?: unknown } = {};
    error.cause = error;
    expect(mapJournalFunctionalCurrencyErrorHelper(error)).toBe(error);
  });
});
