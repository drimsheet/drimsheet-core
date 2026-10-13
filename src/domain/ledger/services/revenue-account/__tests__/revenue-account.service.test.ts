import generateUUID from '@shared/utils/uuid-generator';

import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import makeRevenueAccountService from '@domain/ledger/services/revenue-account/revenue-account.service';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

const mockLedgerAccountRepo: jest.Mocked<ILedgerAccountRepo> = {
  delete: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  findById: jest.fn(),
  findAllByIds: jest.fn(),
  findAllByMaterializedPath: jest.fn(),
  findDescendants: jest.fn(),
  findByCode: jest.fn(),
  findBySubType: jest.fn(),
  findByBehavior: jest.fn(),
  findLatestBySubType: jest.fn(),
  findAll: jest.fn(),
};

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
  const service = makeRevenueAccountService({
    ledgerAccountRepo: mockLedgerAccountRepo,
  });
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

describe('revenue account activation', () => {
  const service = makeRevenueAccountService({
    ledgerAccountRepo: mockLedgerAccountRepo,
  });
  const options = { correlationId: 'activate-revenue' };
  const parent = makeAccount(families[0]);
  const draft = (overrides: Partial<ILedgerAccount> = {}) =>
    makeAccount(families[0], {
      code: '401001',
      materializedPath: '401000.401001',
      accountingEntityId: parent.accountingEntityId,
      controlAccountId: parent.id,
      isControlAccount: false,
      status: 'draft',
      ...overrides,
    });

  beforeEach(() => {
    jest.resetAllMocks();
    mockLedgerAccountRepo.findById.mockResolvedValue(parent);
  });

  it.each(families)(
    'activates posting and control accounts for $behavior',
    async (family) => {
      for (const isControlAccount of [true, false]) {
        const account = draft({
          behavior: family.behavior,
          subType: family.behavior,
          isControlAccount,
        });
        const [activated, events, audit] = await service.activate(
          account,
          options
        );
        expect(activated).toEqual({
          ...account,
          status: 'active',
          version: account.version + 1,
          updatedAt: expect.any(Date),
        });
        expect(account.status).toBe('draft');
        expect(Object.isFrozen(activated)).toBe(true);
        expect(Object.isFrozen(activated.currency)).toBe(true);
        expect(events).toEqual([expect.objectContaining({ data: activated })]);
        expect(audit.diff).toEqual({ before: account, after: activated });
        expect(mockLedgerAccountRepo.findById).toHaveBeenCalledWith(
          parent.id,
          account.accountingEntityId,
          options
        );
        expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
      }
    }
  );

  it.each(['active', 'archived'] as const)(
    'rejects %s accounts',
    async (status) => {
      await expect(
        service.activate(draft({ status }), options)
      ).rejects.toThrow(ledgerAccountError.InvalidStatus);
    }
  );

  it.each(['asset', 'liability', 'equity', 'expense'] as const)(
    'rejects %s accounts before parent lookup',
    async (type) => {
      await expect(service.activate(draft({ type }), options)).rejects.toThrow(
        ledgerAccountError.InvalidType
      );
      expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
    }
  );

  it('rejects accounts without a parent', async () => {
    await expect(
      service.activate(makeAccount(families[0], { status: 'draft' }), options)
    ).rejects.toThrow(ledgerAccountError.InvalidControlAccountId);
    expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
  });

  it('rejects a missing parent', async () => {
    mockLedgerAccountRepo.findById.mockResolvedValue(null);
    await expect(service.activate(draft(), options)).rejects.toThrow(
      ledgerAccountError.ControlAccountNotFound
    );
  });

  it.each([
    ['draft', ledgerAccountError.NonDraftChildOfDraftControlAccount],
    ['archived', ledgerAccountError.ArchivedControlAccount],
  ] as const)('rejects a %s parent', async (status, error) => {
    mockLedgerAccountRepo.findById.mockResolvedValue(
      makeAccount(families[0], { status })
    );
    await expect(service.activate(draft(), options)).rejects.toThrow(error);
  });

  it('propagates parent lookup failures', async () => {
    const error = new ledgerAccountError.ControlAccountNotFound();
    mockLedgerAccountRepo.findById.mockRejectedValue(error);
    await expect(service.activate(draft(), options)).rejects.toBe(error);
  });
});
