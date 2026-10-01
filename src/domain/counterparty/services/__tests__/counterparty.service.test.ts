import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';
import addressValue from '@shared/values/contact-details/address.vo';

import makeCounterpartyService from '@domain/counterparty/services/counterparty.service';
import journalLineEntity from '@domain/journal-entry/entities/journal-line.entity';
import IJournalLineRepo from '@domain/journal-entry/repos/journal-line.repo';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';

const journalLineRepo: jest.Mocked<IJournalLineRepo> = {
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findAllByAccountId: jest.fn(),
  findAllByCounterpartyId: jest.fn(),
};

const [referencedLine] = journalLineEntity.make(
  {
    id: generateUUID(),
    createdBy: generateUUID(),
    memo: null,
    createdAt: new Date(),
  },
  {
    accountId: generateUUID(),
    counterpartyId: generateUUID(),
    sequenceOrder: 1,
    amount: moneyValue.make(1000, SYSTEM_CURRENCIES.NGN, true),
    exchangeRate: null,
    side: 'debit',
    description: null,
    functionalCurrency: SYSTEM_CURRENCIES.NGN,
  }
);
const service = makeCounterpartyService({ journalLineRepo });
const readOptions = { correlationId: 'domain-update' };

beforeEach(() => {
  jest.resetAllMocks();
  journalLineRepo.findAllByCounterpartyId.mockResolvedValue([]);
});
const payload = {
  createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
  accountingEntityId: generateUUID(),
  name: 'Example',
  type: 'organization' as const,
};
const address = addressValue.make({
  line1: 'Main Street',
  city: 'Lagos',
  countryCode: 'NG',
});

describe('Counterparty service', () => {
  it('creates a role-less counterparty with one creation event and audit', () => {
    const [counterparty, events, audit] = service.create(payload);
    expect(counterparty.meta).toEqual({});
    expect(counterparty.roles).toEqual([]);
    expect(events.map((event) => event.type)).toEqual([
      'domain:counterparty:created',
    ]);
    expect(audit.diff).toEqual({ before: null, after: counterparty });
  });

  it.each(['vendor', 'employer', 'contractor'] as const)(
    'creates an audited %s with immutable details',
    (role) => {
      const creation =
        role === 'vendor'
          ? service.create({
              ...payload,
              meta: { vendor: { address } },
            })
          : role === 'employer'
            ? service.create({
                ...payload,
                meta: {
                  employer: {
                    address,
                    displayName: ' Example ',
                  },
                },
              })
            : service.create({
                ...payload,
                meta: { contractor: { address } },
              });
      const [counterparty, events, audit] = creation;
      expect(counterparty.roles).toEqual([role]);
      expect(counterparty.meta[role]?.address).toEqual(address);
      expect(Object.isFrozen(counterparty.meta[role]?.address)).toBe(true);
      expect(events.map((event) => event.type)).toEqual([
        'domain:counterparty:created',
        'domain:counterparty:role-added',
      ]);
      expect(events[1].data).toEqual(counterparty);
      expect(audit.diff).toEqual({ before: null, after: counterparty });
      expect(audit.action).toBe('created');
    }
  );

  it('allows a vendor without an address', () => {
    const [counterparty] = service.create({
      ...payload,
      meta: { vendor: { address: null } },
    });
    expect(counterparty.meta).toEqual({ vendor: { address: null } });
  });
});

describe('metadata-driven creation', () => {
  const rawAddress = {
    line1: ' Main Street ',
    city: ' Lagos ',
    countryCode: 'ng',
  };

  it('accepts empty metadata without assigning a role', () => {
    const [counterparty, events] = service.create({
      ...payload,
      meta: {},
    });
    expect(counterparty.roles).toEqual([]);
    expect(counterparty.status).toBe('active');
    expect(events).toHaveLength(1);
  });

  it.each([1, 2, 3, 4, 5, 6, 7])(
    'creates role combination %i with ordered immutable transitions',
    (mask) => {
      const meta: NonNullable<Parameters<typeof service.create>[0]['meta']> =
        {};
      // Deliberately supply keys in reverse order.
      if (mask & 4)
        meta.contractor = {
          address: { ...rawAddress, line1: ' Contractor Road ' },
        };
      if (mask & 2) meta.vendor = {};
      if (mask & 1)
        meta.employer = { address: rawAddress, displayName: ' Employer ' };
      const before = structuredClone(meta);
      const [counterparty, events, audit] = service.create({
        ...payload,
        meta,
      });
      const expectedRoles = (
        ['employer', 'vendor', 'contractor'] as const
      ).filter((_, i) => mask & (1 << i));
      expect(counterparty.roles).toEqual(expectedRoles);
      expect(events).toHaveLength(expectedRoles.length + 1);
      expect(events[0].data.roles).toEqual([]);
      for (let i = 0; i < expectedRoles.length; i++) {
        expect(events[i + 1].type).toBe('domain:counterparty:role-added');
        expect(events[i + 1].data.roles).toEqual(expectedRoles.slice(0, i + 1));
        expect(Object.isFrozen(events[i + 1].data.meta)).toBe(true);
      }
      expect(audit.action).toBe('created');
      expect(audit.diff).toEqual({ before: null, after: counterparty });
      expect(meta).toEqual(before);
      if (meta.employer)
        expect(counterparty.meta.employer).toEqual({
          displayName: 'Employer',
          address,
        });
      if (meta.vendor)
        expect(counterparty.meta.vendor).toEqual({ address: null });
      if (meta.contractor)
        expect(counterparty.meta.contractor?.address).toEqual({
          ...address,
          line1: 'Contractor Road',
        });
    }
  );

  it.each([
    null,
    [],
    new Date(),
    'vendor',
    { customer: {} },
    { employer: null },
    { vendor: undefined },
    { vendor: null },
    { contractor: [] },
    { vendor: { unknown: 1 } },
    { employer: { address: rawAddress, displayName: 2 } },
    { employer: {} },
    { contractor: { address: null } },
    { vendor: { address: { ...rawAddress, extra: true } } },
    { contractor: { address: { ...rawAddress, line2: 42 } } },
    { contractor: { address: { ...rawAddress, region: [] } } },
    { vendor: { address: { ...rawAddress, postalCode: {} } } },
    { employer: { address: { ...rawAddress, line1: '' } } },
    {
      vendor: {},
      contractor: { address: { ...rawAddress, countryCode: 'invalid' } },
    },
  ])('rejects the entire creation for invalid raw metadata %j', (meta) => {
    expect(() =>
      service.create({
        ...payload,
        meta,
      } as unknown as Parameters<typeof service.create>[0])
    ).toThrow();
  });
});

describe('counterparty updates', () => {
  const draft = () =>
    service.create({
      ...payload,
      status: 'draft',
      meta: { employer: { address }, vendor: { address } },
    })[0];

  it('activates with corrections and one complete immutable activation audit', async () => {
    const before = draft();
    const snapshot = structuredClone(before);
    const [after, events, audit] = await service.update(
      before,
      {
        name: ' Corrected ',
        type: 'individual',
        meta: { vendor: {} },
        status: 'active',
      },
      readOptions
    );
    expect(after).toMatchObject({
      id: before.id,
      createdBy: before.createdBy,
      accountingEntityId: before.accountingEntityId,
      createdAt: before.createdAt,
      name: 'Corrected',
      type: 'individual',
      status: 'active',
      roles: ['vendor'],
      meta: { vendor: { address: null } },
    });
    expect(before).toEqual(snapshot);
    expect(Object.isFrozen(after)).toBe(true);
    expect(Object.isFrozen(after.meta.vendor)).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'domain:counterparty:activated',
      data: after,
    });
    expect(audit).toMatchObject({
      action: 'activated',
      diff: { before, after },
    });
    expect(audit.diff.before?.roles).toContain('employer');
    expect(audit.diff.after.roles).not.toContain('employer');
  });

  it.each(['draft', 'active'] as const)(
    'edits %s without activating and preserves omitted roles',
    async (status) => {
      const [before] = service.create({
        ...payload,
        status,
        meta: { vendor: {} },
      });
      const [after, events, audit] = await service.update(
        before,
        {
          name: 'Changed',
        },
        readOptions
      );
      expect(after.status).toBe(status);
      expect(after.meta).toEqual(before.meta);
      expect(after.roles).toEqual(before.roles);
      expect(events[0].type).toBe('domain:counterparty:updated');
      expect(audit.action).toBe('updated');
    }
  );

  it('activates a minimal draft with no roles', async () => {
    const [before] = service.create({ ...payload, status: 'draft' });
    expect(
      (await service.update(before, { status: 'active' }, readOptions))[0]
    ).toMatchObject({
      status: 'active',
      roles: [],
      meta: {},
    });
  });

  it.each([0, 1, 2, 3, 4, 5, 6, 7])(
    'replaces all roles for role mask %i, including clearing',
    async (mask) => {
      const meta: NonNullable<Parameters<typeof service.update>[1]['meta']> =
        {};
      if (mask & 1) meta.employer = { address };
      if (mask & 2) meta.vendor = {};
      if (mask & 4) meta.contractor = { address };
      const [after] = await service.update(draft(), { meta }, readOptions);
      expect(after.roles).toEqual(
        (['employer', 'vendor', 'contractor'] as const).filter(
          (_, index) => mask & (1 << index)
        )
      );
      expect(Object.keys(after.meta)).toEqual(after.roles);
      if (after.meta.employer)
        expect(after.meta.employer.displayName).toBeNull();
      if (after.meta.vendor) expect(after.meta.vendor.address).toBeNull();
      if (after.meta.contractor)
        expect(Object.isFrozen(after.meta.contractor.address)).toBe(true);
    }
  );

  it.each([
    {},
    { name: ' Example ' },
    { type: 'organization' as const },
    { meta: { employer: { address }, vendor: { address } } },
  ])('rejects an effective no-change update %j', async (changes) => {
    await expect(service.update(draft(), changes, readOptions)).rejects.toThrow(
      'counterparty_error_update_invalid'
    );
  });

  it.each(['active', 'archived'] as const)(
    'rejects activation from %s',
    async (status) => {
      const [before] = service.create({ ...payload, status });
      await expect(
        service.update(before, { status: 'active' }, readOptions)
      ).rejects.toThrow(
        status === 'active'
          ? 'counterparty_error_already_active_conflict'
          : 'counterparty_error_archived_conflict'
      );
    }
  );

  it('rejects ordinary updates to Archived', async () => {
    const [before] = service.create({ ...payload, status: 'archived' });
    await expect(
      service.update(before, { name: 'Changed' }, readOptions)
    ).rejects.toThrow('counterparty_error_archived_conflict');
  });

  it.each([
    { status: 'draft' },
    { status: 'archived' },
    { name: '' },
    { type: null },
    { meta: null },
    { meta: { employer: {} } },
    { meta: { vendor: null } },
    { meta: { contractor: { address: { ...address, city: '' } } } },
    { meta: { employer: { address, displayName: 'x'.repeat(256) } } },
  ])('rejects invalid changes atomically %j', async (changes) => {
    const before = draft();
    const snapshot = structuredClone(before);
    await expect(
      service.update(before, changes as never, readOptions)
    ).rejects.toThrow();
    expect(before).toEqual(snapshot);
  });

  it.each(['employer', 'vendor', 'contractor'] as const)(
    'maps shared address faults to %s field context',
    async (role) => {
      try {
        await service.update(
          draft(),
          {
            meta: { [role]: { address: { ...address, city: '' } } },
          },
          readOptions
        );
        throw new Error('Expected invalid address');
      } catch (error) {
        expect(error).toMatchObject({
          errorKey: 'counterparty_error_address_invalid',
          cause: { field: `meta.${role}.address` },
        });
      }
    }
  );
});

describe('counterparty service version composition', () => {
  it('keeps the final creation audit version aligned with all assigned roles', () => {
    const [counterparty, events, audit] = makeCounterpartyService({
      journalLineRepo,
    }).create({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      accountingEntityId: 'a1111111-1111-4111-8111-111111111112' as TEntityId,
      name: 'Supplier',
      type: 'organization',
      status: 'draft',
      meta: {
        vendor: {},
        employer: {
          address: { line1: 'Road', city: 'Lagos', countryCode: 'NG' },
        },
      },
    });
    expect(counterparty.version).toBe(3);
    expect(audit.entityVersion).toBe(counterparty.version);
    expect(audit.diff.after?.version).toBe(counterparty.version);
    expect(events.map((event) => event.data.version)).toEqual([1, 2, 3]);
  });
});

describe('counterparty type changes after transaction use', () => {
  it.each(['individual', 'organization'] as const)(
    'allows unused %s to change type',
    async (type) => {
      const [before] = service.create({ ...payload, type });
      const nextType = type === 'individual' ? 'organization' : 'individual';
      const [after, , audit] = await service.update(
        before,
        { type: nextType },
        readOptions
      );
      expect(after.type).toBe(nextType);
      expect(audit.diff.before?.type).toBe(type);
      expect(audit.diff.after.type).toBe(nextType);
      expect(journalLineRepo.findAllByCounterpartyId).toHaveBeenCalledWith(
        before.id,
        before.accountingEntityId,
        readOptions
      );
    }
  );

  it.each(['individual', 'organization'] as const)(
    'rejects a used %s combined mutation without changing input',
    async (type) => {
      const [before] = service.create({ ...payload, type, status: 'draft' });
      const snapshot = structuredClone(before);
      journalLineRepo.findAllByCounterpartyId.mockResolvedValue([
        referencedLine,
      ]);
      await expect(
        service.update(
          before,
          {
            type: type === 'individual' ? 'organization' : 'individual',
            name: 'Changed',
            meta: { vendor: {} },
            status: 'active',
          },
          readOptions
        )
      ).rejects.toMatchObject({
        errorKey:
          'counterparty_error_type_change_after_transaction_use_conflict',
        cause: {
          field: 'type',
          reason: 'transaction_usage',
          nextAction: 'create_counterparty',
        },
      });
      expect(before).toEqual(snapshot);
    }
  );

  it.each([undefined, 'organization'] as const)(
    'skips usage for omitted or unchanged type %s',
    async (type) => {
      const [before] = service.create(payload);
      journalLineRepo.findAllByCounterpartyId.mockResolvedValue([
        referencedLine,
      ]);
      const [after] = await service.update(
        before,
        { type, name: 'Changed', meta: {} },
        readOptions
      );
      expect(after.type).toBe(before.type);
      expect(journalLineRepo.findAllByCounterpartyId).not.toHaveBeenCalled();
    }
  );

  it('propagates an invariant read failure', async () => {
    const [before] = service.create(payload);
    const failure = new Error('usage lookup failed');
    journalLineRepo.findAllByCounterpartyId.mockRejectedValue(failure);
    await expect(
      service.update(before, { type: 'individual' }, readOptions)
    ).rejects.toBe(failure);
  });

  it('rejects an invalid requested type before reading usage', async () => {
    const [before] = service.create(payload);
    await expect(
      service.update(before, { type: 'other' as never }, readOptions)
    ).rejects.toThrow('counterparty_error_type_invalid');
    expect(journalLineRepo.findAllByCounterpartyId).not.toHaveBeenCalled();
  });
});
