import generateUUID from '@shared/utils/uuid-generator';

import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import makeRevenueAccountService from '@domain/ledger/services/revenue-account/revenue-account.service';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

const families = [
  { behavior: 'services', code: '401000' },
  { behavior: 'employment_income', code: '403000' },
  { behavior: 'gain_on_asset_sale', code: '405000' },
  { behavior: 'unrealized_gains', code: '406000' },
  { behavior: 'grants', code: '407000' },
  { behavior: 'gifts', code: '408000' },
] as const;

function makeAccount(
  family: (typeof families)[number],
  overrides: Partial<ILedgerAccount> = {}
) {
  return ledgerAccountEntity.make<ILedgerAccount>({
    name: 'Revenue account',
    code: family.code,
    materializedPath: family.code,
    accountingEntityId: generateUUID(),
    createdBy: generateUUID(),
    type: 'revenue',
    subType: family.behavior,
    behavior: family.behavior,
    normalBalance: 'credit',
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

describe('revenueAccountService', () => {
  const service = makeRevenueAccountService();
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
            service.update(child, { name: 'Updated revenue' })
          ).not.toThrow();
        }
        expect(() =>
          service.update(header, { name: 'Updated revenue' })
        ).not.toThrow();
      }
    }
  );

  it('normalizes the name and returns one immutable transition, event, and audit', () => {
    const account = makeAccount(families[0]);
    const [updated, events, audit] = service.update(account, {
      name: '  Consulting revenue  ',
    });
    expect(updated).toEqual({
      ...account,
      name: 'Consulting revenue',
      version: account.version + 1,
      updatedAt: expect.any(Date),
    });
    expect(account.name).toBe('Revenue account');
    expect(Object.isFrozen(updated)).toBe(true);
    expect(Object.isFrozen(service)).toBe(true);
    expect(events).toEqual([expect.objectContaining({ data: updated })]);
    expect(audit?.diff).toEqual({ before: account, after: updated });
  });

  it('returns the same account and no events or audit for a normalized no-op', () => {
    const account = makeAccount(families[0]);
    const [updated, events, audit] = service.update(account, {
      name: '  Revenue account  ',
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

  it.each(['asset', 'liability', 'equity', 'expense'] as const)(
    'rejects %s accounts',
    (type) => {
      const account = makeAccount(families[0], { type });
      expect(() =>
        service.update(account, { name: 'Updated revenue' })
      ).toThrow(ledgerAccountError.InvalidType);
    }
  );

  it('rejects archived revenue accounts', () => {
    const account = makeAccount(families[0], { status: 'archived' });
    expect(() => service.update(account, { name: 'Updated revenue' })).toThrow(
      ledgerAccountError.InvalidStatus
    );
  });
});
