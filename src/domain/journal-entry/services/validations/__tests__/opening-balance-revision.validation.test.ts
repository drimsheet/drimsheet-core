import { TEntityId } from '@shared/types/uuid';

import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import openingBalanceRevisionValidation from '@domain/journal-entry/services/validations/opening-balance-revision.validation';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

function makeFixture() {
  const [account] = ledgerAccountEntity.make({
    code: '100001',
    materializedPath: '100000.100001',
    accountingEntityId: 'b2222222-2222-4222-8222-222222222222' as TEntityId,
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    controlAccountId: 'c3333333-3333-4333-8333-333333333333' as TEntityId,
    name: 'Petty cash',
    type: 'asset',
    subType: 'cash_and_cash_equivalent',
    behavior: 'petty_cash',
    normalBalance: 'debit',
    isControlAccount: false,
    currency: SYSTEM_CURRENCIES.NGN,
    status: 'draft',
    contraAccountRule: 'contra_permitted',
    adjunctAccountRule: 'adjunct_permitted',
    meta: null,
  });
  const [entry] = journalEntryEntity.make({
    accountingEntityId: account.accountingEntityId,
    sourceType: 'opening_balance',
    effectiveDate: new Date('2026-03-01T00:00:00.000Z'),
    postedAt: null,
    memo: 'Opening balance',
    createdBy: account.createdBy,
    functionalCurrency: SYSTEM_CURRENCIES.NGN,
    lines: [
      {
        accountId: account.id,
        sequenceOrder: 1,
        amount: { amount: 100n, currency: SYSTEM_CURRENCIES.NGN },
        exchangeRate: null,
        side: 'debit',
        description: null,
        functionalCurrency: SYSTEM_CURRENCIES.NGN,
      },
      {
        accountId: account.controlAccountId!,
        sequenceOrder: 2,
        amount: { amount: 100n, currency: SYSTEM_CURRENCIES.NGN },
        exchangeRate: null,
        side: 'credit',
        description: null,
        functionalCurrency: SYSTEM_CURRENCIES.NGN,
      },
    ],
  });

  return { account, entry };
}

describe('opening balance revision validation', () => {
  it('accepts retained line sequences and rejects a missing original sequence', () => {
    const { entry } = makeFixture();
    expect(() =>
      openingBalanceRevisionValidation.validateLineSequences(entry, entry)
    ).not.toThrow();
    expect(() =>
      openingBalanceRevisionValidation.validateLineSequences(
        { ...entry, lines: [entry.lines[0]] },
        entry
      )
    ).toThrow(journalEntryError.MismatchedJournalLines);
  });
  it('accepts a draft opening balance associated with the account', () => {
    const { account, entry } = makeFixture();

    expect(() => {
      openingBalanceRevisionValidation.validateSourceType(entry);
      openingBalanceRevisionValidation.validateStatus(entry);
      openingBalanceRevisionValidation.validateAccountAssociation(
        entry,
        account
      );
    }).not.toThrow();
  });

  it.each([
    ['source type', { sourceType: 'payment' as const }],
    [
      'status',
      {
        status: 'posted' as const,
        postedAt: new Date('2026-03-01T00:00:00.000Z'),
      },
    ],
  ])('rejects an invalid %s', (_case, change) => {
    const { account, entry } = makeFixture();
    const changedEntry = { ...entry, ...change };

    expect(() => {
      openingBalanceRevisionValidation.validateSourceType(changedEntry);
      openingBalanceRevisionValidation.validateStatus(changedEntry);
      openingBalanceRevisionValidation.validateAccountAssociation(
        changedEntry,
        account
      );
    }).toThrow(journalEntryError.RectificationNotPermitted);
  });

  it('rejects an entry that does not reference the account', () => {
    const { account, entry } = makeFixture();

    expect(() =>
      openingBalanceRevisionValidation.validateAccountAssociation(entry, {
        id: account.controlAccountId!,
      })
    ).not.toThrow();
    expect(() =>
      openingBalanceRevisionValidation.validateAccountAssociation(entry, {
        id: 'd4444444-4444-4444-8444-444444444444' as TEntityId,
      })
    ).toThrow(journalEntryError.RectificationNotPermitted);
  });
});
