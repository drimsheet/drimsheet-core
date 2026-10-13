import generateUUID from '@shared/utils/uuid-generator';

import ledgerAccountBalanceEntity from '@domain/ledger/entities/ledger-account-balance.entity';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountBalanceError from '@domain/ledger/errors/ledger-account-balance.error';
import makeLedgerAccountBalanceService from '@domain/ledger/services/ledger-account-balance.service';
import currencyEntity from '@domain/money/entities/currency.entity';

const service = makeLedgerAccountBalanceService();
const ngn = currencyEntity.getByCode('NGN');
const usd = currencyEntity.getByCode('USD');

function makeAccount(currency = ngn) {
  return ledgerAccountEntity.make({
    name: 'Office cash',
    code: '100042',
    materializedPath: '100000.100042',
    accountingEntityId: generateUUID(),
    createdBy: generateUUID(),
    type: 'asset',
    subType: 'cash_and_cash_equivalent',
    behavior: 'petty_cash',
    normalBalance: 'debit',
    isControlAccount: false,
    controlAccountId: generateUUID(),
    currency,
    status: 'draft',
    contraAccountRule: 'contra_permitted',
    adjunctAccountRule: 'adjunct_permitted',
    meta: { lastReconciliationDate: null },
  })[0];
}

function makeBalance(account: ReturnType<typeof makeAccount>) {
  return ledgerAccountBalanceEntity.make({
    ledgerAccountId: account.id,
    accountingEntityId: account.accountingEntityId,
    createdBy: account.createdBy,
    accountMaterializedPath: account.materializedPath,
    currencyCode: account.currency?.code ?? 'NGN',
    functionalCurrencyCode: 'NGN',
  });
}

describe('ledgerAccountBalanceService.updateBalance', () => {
  it('returns the same balance for changes that do not change the currency', () => {
    const previous = makeAccount();
    const [updated] = ledgerAccountEntity.update(previous, {
      name: 'Branch cash',
    });
    const balance = makeBalance(previous);
    expect(
      service.updateBalance({
        existingAccount: previous,
        updatedAccount: updated,
        existingBalance: balance,
      })
    ).toBe(balance);
    expect(Object.isFrozen(service)).toBe(true);
  });

  it('prepares the new denomination while retaining the functional balance and creation attribution', () => {
    const previous = makeAccount();
    const [updated] = ledgerAccountEntity.update(previous, { currency: usd });
    const balance = makeBalance(previous);
    const result = service.updateBalance({
      existingAccount: previous,
      updatedAccount: updated,
      existingBalance: balance,
    });
    expect(result).toEqual({
      ...balance,
      amount: { amount: 0n, currency: usd },
      version: balance.version + 1,
      updatedAt: expect.any(Date),
    });
    expect(balance.amount.currency).toBe(ngn);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('does not change a balance already in the new account currency', () => {
    const previous = makeAccount();
    const [updated] = ledgerAccountEntity.update(previous, { currency: usd });
    const balance = makeBalance(updated);
    expect(
      service.updateBalance({
        existingAccount: previous,
        updatedAccount: updated,
        existingBalance: balance,
      })
    ).toBe(balance);
  });

  it('uses functional currency for an account without a fixed currency', () => {
    const [multiCurrencyAccount] = ledgerAccountEntity.make({
      ...makeAccount(),
      currency: null,
    });
    const [fixedCurrencyAccount] = ledgerAccountEntity.update(
      multiCurrencyAccount,
      { currency: usd }
    );
    const balance = makeBalance(fixedCurrencyAccount);
    const result = service.updateBalance({
      existingAccount: fixedCurrencyAccount,
      updatedAccount: multiCurrencyAccount,
      existingBalance: balance,
    });
    expect(result.amount).toEqual({ amount: 0n, currency: ngn });
  });

  it('handles a change from an account without a fixed currency', () => {
    const [previous] = ledgerAccountEntity.make({
      ...makeAccount(),
      currency: null,
    });
    const [updated] = ledgerAccountEntity.update(previous, { currency: usd });
    const result = service.updateBalance({
      existingAccount: previous,
      updatedAccount: updated,
      existingBalance: makeBalance(previous),
    });
    expect(result.amount).toEqual({ amount: 0n, currency: usd });
  });

  it.each([
    [1n, 0n],
    [0n, 1n],
  ])(
    'rejects nonzero transaction %s or functional %s balances',
    (amount, functionalAmount) => {
      const previous = makeAccount();
      const [updated] = ledgerAccountEntity.update(previous, { currency: usd });
      const { newBalance } = ledgerAccountBalanceEntity.adjust(
        makeBalance(previous),
        {
          ledgerAccountId: previous.id,
          journalEntryId: generateUUID(),
          createdBy: previous.createdBy,
          amount: { amount, currency: ngn },
          functionalAmount: { amount: functionalAmount, currency: ngn },
        }
      );
      expect(() =>
        service.updateBalance({
          existingAccount: previous,
          updatedAccount: updated,
          existingBalance: newBalance,
        })
      ).toThrow(ledgerAccountBalanceError.CurrencyChangeNonZeroBalance);
    }
  );
});
