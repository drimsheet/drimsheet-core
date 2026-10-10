import generateUUID from '@shared/utils/uuid-generator';

import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import makeExpenseAccountService from '@domain/ledger/services/expense-account/expense-account.service';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

const families = [
  { behavior: 'default_direct_cost', subType: 'direct_costs', code: '500000' },
  { behavior: 'cogs', subType: 'direct_costs', code: '500000' },
  { behavior: 'cost_of_services', subType: 'direct_costs', code: '500000' },
  { behavior: 'cost_of_revenue', subType: 'direct_costs', code: '500000' },
  {
    behavior: 'rent_and_utilities',
    subType: 'rent_and_utilities',
    code: '502000',
  },
  { behavior: 'bank_charge', subType: 'bank_charge', code: '507000' },
  { behavior: 'finance_cost', subType: 'finance_cost', code: '508000' },
  { behavior: 'interest', subType: 'interest', code: '509000' },
  { behavior: 'tax_expense', subType: 'income_tax_expense', code: '510000' },
  { behavior: 'unrealized_loss', subType: 'unrealized_loss', code: '511000' },
  {
    behavior: 'asset_disposal_loss',
    subType: 'loss_on_asset_disposal',
    code: '512000',
  },
] as const;

function makeAccount(
  family: (typeof families)[number],
  overrides: Partial<ILedgerAccount> = {}
) {
  return ledgerAccountEntity.make<ILedgerAccount>({
    name: 'Expense account',
    code: family.code,
    materializedPath: family.code,
    accountingEntityId: generateUUID(),
    createdBy: generateUUID(),
    type: 'expense',
    subType: family.subType,
    behavior: family.behavior,
    normalBalance: 'debit',
    isControlAccount: true,
    controlAccountId: null,
    currency: SYSTEM_CURRENCIES.NGN,
    status: 'active',
    meta: null,
    contraAccountRule: 'contra_not_permitted',
    adjunctAccountRule: 'adjunct_not_permitted',
    ...overrides,
  })[0];
}

describe('expenseAccountService', () => {
  const service = makeExpenseAccountService();
  it.each(families)(
    'allows active and draft posting, control, and header accounts for $behavior',
    (family) => {
      for (const status of ['active', 'draft'] as const) {
        const header = makeAccount(family, { status });
        const code = family.code.slice(0, 3) + '001';
        for (const isControlAccount of [true, false]) {
          const child = makeAccount(family, {
            status,
            isControlAccount,
            controlAccountId: header.id,
            code,
            materializedPath: `${header.code}.${code}`,
            currency: null,
          });
          expect(() =>
            service.update(child, { name: 'Updated expense' })
          ).not.toThrow();
        }
        expect(() =>
          service.update(header, { name: 'Updated expense' })
        ).not.toThrow();
      }
    }
  );

  it('normalizes the name and returns one immutable transition, event, and audit', () => {
    const account = makeAccount(families[0]);
    const [updated, events, audit] = service.update(account, {
      name: '  Consulting expense  ',
    });
    expect(updated).toEqual({
      ...account,
      name: 'Consulting expense',
      version: account.version + 1,
      updatedAt: expect.any(Date),
    });
    expect(account.name).toBe('Expense account');
    expect(Object.isFrozen(updated)).toBe(true);
    expect(Object.isFrozen(service)).toBe(true);
    expect(events).toEqual([expect.objectContaining({ data: updated })]);
    expect(audit?.diff).toEqual({ before: account, after: updated });
  });

  it('returns the same account and no events or audit for a normalized no-op', () => {
    const account = makeAccount(families[0]);
    const [updated, events, audit] = service.update(account, {
      name: '  Expense account  ',
    });
    expect(updated).toBe(account);
    expect(events).toEqual([]);
    expect(audit).toBeNull();
  });

  it.each(['', ' ', 'x', 'x'.repeat(101)])(
    'rejects invalid names: %s',
    (name) => {
      const account = makeAccount(families[0]);
      expect(() => service.update(account, { name })).toThrow(
        ledgerAccountError.InvalidName
      );
    }
  );

  it.each(['asset', 'liability', 'equity', 'revenue'] as const)(
    'rejects %s accounts',
    (type) => {
      const account = makeAccount(families[0], { type });
      expect(() =>
        service.update(account, { name: 'Updated expense' })
      ).toThrow(ledgerAccountError.InvalidType);
    }
  );

  it('rejects archived expense accounts', () => {
    const account = makeAccount(families[0], { status: 'archived' });
    expect(() => service.update(account, { name: 'Updated expense' })).toThrow(
      ledgerAccountError.InvalidStatus
    );
  });
});
