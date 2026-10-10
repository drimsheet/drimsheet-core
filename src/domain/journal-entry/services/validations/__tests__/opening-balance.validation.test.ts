import { TEntityId } from '@shared/types/uuid';

import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import openingBalanceValidation from '@domain/journal-entry/services/validations/opening-balance.validation';
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

describe('opening balance validation', () => {
  it('accepts a posting account with no existing opening balance or adjustments', () => {
    const { account } = makeFixture();
    expect(() => {
      openingBalanceValidation.validatePostingAccount(account);
      openingBalanceValidation.validateNoOpeningBalance(account);
      openingBalanceValidation.validateNoBalanceAdjustments(account.id, false);
      openingBalanceValidation.validateEquityAccount(account);
      openingBalanceValidation.validateUnpersistedAccount(account.id, false);
    }).not.toThrow();
  });
  it('rejects a control account', () => {
    const { account } = makeFixture();
    expect(() =>
      openingBalanceValidation.validatePostingAccount({
        ...account,
        isControlAccount: true,
      })
    ).toThrow(journalEntryError.ControlAccountOpeningBalanceNotAllowed);
  });
  it('rejects existing balance adjustments', () => {
    const { account } = makeFixture();
    expect(() =>
      openingBalanceValidation.validateNoBalanceAdjustments(account.id, true)
    ).toThrow(journalEntryError.ExistingOpeningBalance);
  });
  it('rejects missing equity configuration', () => {
    expect(() =>
      openingBalanceValidation.validateEquityAccount(undefined)
    ).toThrow(journalEntryError.UnConfiguredOpeningBalanceAccount);
  });
  it('rejects an existing opening date', () => {
    const { account } = makeFixture();
    expect(() =>
      openingBalanceValidation.validateNoOpeningBalance({
        ...account,
        openingBalanceDate: new Date('2026-03-01'),
      })
    ).toThrow(journalEntryError.ExistingOpeningBalance);
  });
  it('accepts an initial opening date on the same day', () => {
    const { account } = makeFixture();
    expect(() =>
      openingBalanceValidation.validateInitialDate(
        { ...account, openingBalanceDate: new Date('2026-03-01T10:00:00Z') },
        new Date('2026-03-01T12:00:00Z')
      )
    ).not.toThrow();
  });
  it.each([null, new Date('2026-02-01')])(
    'rejects an invalid initial date: %s',
    (openingBalanceDate) => {
      const { account } = makeFixture();
      expect(() =>
        openingBalanceValidation.validateInitialDate(
          { ...account, openingBalanceDate },
          new Date('2026-03-01')
        )
      ).toThrow(journalEntryError.InvalidOpeningBalanceDate);
    }
  );
  it('rejects an already persisted initial account', () => {
    const { account } = makeFixture();
    expect(() =>
      openingBalanceValidation.validateUnpersistedAccount(account.id, true)
    ).toThrow(journalEntryError.InitialOpeningBalanceAccountAlreadyExists);
  });
});
