import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';
import addressValue from '@shared/values/contact-details/address.vo';

import counterpartyEntity from '@domain/counterparty/entities/counterparty.entity';
import counterpartyError from '@domain/counterparty/errors/counterparty.error';
import {
  ECounterpartyRole,
  ECounterpartyStatus,
  ECounterpartyType,
  IMakeCounterpartyPayload,
} from '@domain/counterparty/types/counterparty.types';

describe('Counterparty Entity', () => {
  const accountingEntityId = generateUUID();

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-31T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('make', () => {
    it('creates an immutable draft with only name and type business fields', () => {
      const [counterparty, events, audit] = counterpartyEntity.make({
        createdBy: generateUUID(),
        accountingEntityId,
        name: 'Draft supplier',
        type: ECounterpartyType.Organization,
        status: ECounterpartyStatus.Draft,
      });
      expect(counterparty).toMatchObject({
        status: 'draft',
        roles: [],
        meta: {},
      });
      expect(Object.isFrozen(counterparty)).toBe(true);
      expect(events[0].data).toEqual(counterparty);
      expect(audit.diff.after).toEqual(counterparty);
    });

    it('should create a valid counterparty with empty roles array', () => {
      const payload: IMakeCounterpartyPayload = {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        accountingEntityId,
        name: '  Acme Corp  ',
        type: ECounterpartyType.Organization,
      };

      const [counterparty, events, audit] = counterpartyEntity.make(payload);

      expect(counterparty.version).toBe(1);
      expect(audit.entityVersion).toBe(1);
      expect(counterparty.accountingEntityId).toBe(accountingEntityId);
      expect(counterparty.name).toBe('Acme Corp');
      expect(counterparty.type).toBe(ECounterpartyType.Organization);
      expect(counterparty.status).toBe(ECounterpartyStatus.Active);
      expect(counterparty.roles).toEqual([]);
      expect(counterparty.createdAt).toEqual(
        new Date('2026-07-31T12:00:00.000Z')
      );
      expect(counterparty.updatedAt).toEqual(
        new Date('2026-07-31T12:00:00.000Z')
      );
      expect(Object.isFrozen(counterparty)).toBe(true);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('domain:counterparty:created');
      expect(events[0].data).toEqual(counterparty);

      expect(audit.entityId).toBe(counterparty.id);
      expect(audit.action).toBe('created');
      expect(audit.diff.before).toBeNull();
      expect(audit.diff.after).toEqual(counterparty);
    });

    it('should allow explicitly passing status', () => {
      const payload: IMakeCounterpartyPayload = {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        accountingEntityId,
        name: 'John Doe',
        type: ECounterpartyType.Individual,
        status: ECounterpartyStatus.Archived,
      };

      const [counterparty] = counterpartyEntity.make(payload);

      expect(counterparty.status).toBe(ECounterpartyStatus.Archived);
    });

    it('should throw InvalidAccountingEntityId if accountingEntityId is invalid', () => {
      const payload: IMakeCounterpartyPayload = {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        accountingEntityId: 'invalid-id' as TEntityId,
        name: 'Jane Doe',
        type: ECounterpartyType.Individual,
      };

      expect(() => counterpartyEntity.make(payload)).toThrow(
        counterpartyError.InvalidAccountingEntityId
      );
    });

    it('should throw InvalidName if name is empty', () => {
      const payload: IMakeCounterpartyPayload = {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        accountingEntityId,
        name: '',
        type: ECounterpartyType.Individual,
      };

      expect(() => counterpartyEntity.make(payload)).toThrow(
        counterpartyError.InvalidName
      );
    });
  });

  describe('addRole', () => {
    it('should add a role to the counterparty successfully', () => {
      const [initialCounterparty] = counterpartyEntity.make({
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        accountingEntityId,
        name: 'Vendor Inc',
        type: ECounterpartyType.Organization,
      });

      jest.setSystemTime(new Date('2026-07-31T13:00:00.000Z'));

      const [updatedCounterparty, events, audit] = counterpartyEntity.addRole(
        initialCounterparty,
        { role: ECounterpartyRole.Vendor, meta: { address: null } }
      );

      expect(initialCounterparty.version).toBe(1);
      expect(updatedCounterparty.version).toBe(2);
      expect(audit.entityVersion).toBe(2);
      expect(updatedCounterparty.roles).toEqual([ECounterpartyRole.Vendor]);
      expect(updatedCounterparty.updatedAt).toEqual(
        new Date('2026-07-31T13:00:00.000Z')
      );
      expect(Object.isFrozen(updatedCounterparty)).toBe(true);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('domain:counterparty:role-added');
      expect(events[0].data).toEqual(updatedCounterparty);

      expect(audit.action).toBe('role-added');
      expect(audit.diff.before).toEqual(initialCounterparty);
      expect(audit.diff.after).toEqual(updatedCounterparty);
    });

    it('should throw RoleAlreadyAssigned if role is already assigned', () => {
      const [initialCounterparty] = counterpartyEntity.make({
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        accountingEntityId,
        name: 'Vendor Inc',
        type: ECounterpartyType.Organization,
      });

      const [counterpartyWithRole] = counterpartyEntity.addRole(
        initialCounterparty,
        { role: ECounterpartyRole.Vendor, meta: { address: null } }
      );

      expect(() =>
        counterpartyEntity.addRole(counterpartyWithRole, {
          role: ECounterpartyRole.Vendor,
          meta: { address: null },
        })
      ).toThrow(counterpartyError.RoleAlreadyAssigned);
    });

    it('should throw InvalidRole for invalid role', () => {
      const [initialCounterparty] = counterpartyEntity.make({
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        accountingEntityId,
        name: 'Vendor Inc',
        type: ECounterpartyType.Organization,
      });

      expect(() =>
        counterpartyEntity.addRole(initialCounterparty, {
          role: 'invalid-role',
          meta: { address: null },
        } as unknown as Parameters<typeof counterpartyEntity.addRole>[1])
      ).toThrow(counterpartyError.InvalidRole);
    });
  });
});

describe('counterparty archive transition', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-04T10:00:00.000Z'));
  });

  afterEach(() => jest.useRealTimers());

  it.each(['draft', 'active'] as const)(
    'archives a %s counterparty without changing its details',
    (status) => {
      const [initial] = counterpartyEntity.make({
        createdBy: generateUUID(),
        accountingEntityId: generateUUID(),
        name: 'Supplier',
        type: 'organization',
        status,
      });
      const [before] = counterpartyEntity.addRole(initial, {
        role: 'vendor',
        meta: { address: null },
      });
      const timestamp = new Date('2026-10-04T11:00:00.000Z');
      jest.setSystemTime(timestamp);

      const [after, events, audit] = counterpartyEntity.archive(before);

      expect(after).toEqual({
        ...before,
        status: 'archived',
        version: before.version + 1,
        updatedAt: timestamp,
      });
      expect(after).not.toBe(before);
      expect(before.status).toBe(status);
      expect(before.version).toBe(2);
      expect(before.updatedAt).toEqual(initial.updatedAt);
      expect(Object.isFrozen(after)).toBe(true);
      expect(Object.isFrozen(after.roles)).toBe(true);
      expect(Object.isFrozen(after.meta)).toBe(true);
      expect(Object.isFrozen(after.meta.vendor)).toBe(true);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'domain:counterparty:archived',
        data: after,
      });
      expect(audit).toMatchObject({
        entityId: before.id,
        entityVersion: after.version,
        action: 'archived',
        occurredAt: timestamp,
        diff: {
          before: {
            status,
            version: before.version,
            updatedAt: before.updatedAt,
          },
          after: {
            status: 'archived',
            version: after.version,
            updatedAt: timestamp,
          },
        },
      });
      expect(audit!.diff.before).toEqual(before);
      expect(audit!.diff.after).toEqual(after);
      jest.setSystemTime(new Date('2026-10-04T12:00:00.000Z'));
      const [unchanged, repeatedEvents, repeatedAudit] =
        counterpartyEntity.archive(after);
      expect(unchanged).toBe(after);
      expect(unchanged.version).toBe(after.version);
      expect(unchanged.updatedAt).toEqual(timestamp);
      expect(repeatedEvents).toEqual([]);
      expect(repeatedAudit).toBeNull();
      expect(() =>
        counterpartyEntity.update(after, { name: 'Changed' })
      ).toThrow(counterpartyError.Archived);
    }
  );

  it('rejects an invalid source before constructing a transition', () => {
    expect(() => counterpartyEntity.archive(null as never)).toThrow(
      counterpartyError.InvalidCounterpartyEntity
    );
    const [before] = counterpartyEntity.make({
      createdBy: generateUUID(),
      accountingEntityId: generateUUID(),
      name: 'Supplier',
      type: 'individual',
    });
    expect(() => counterpartyEntity.archive({ ...before, version: 0 })).toThrow(
      counterpartyError.InvalidVersion
    );
    expect(() =>
      counterpartyEntity.archive({ ...before, status: 'unknown' as never })
    ).toThrow(counterpartyError.InvalidStatus);
    expect(before.status).toBe('active');
    expect(before.version).toBe(1);
  });
});

describe('Counterparty role metadata transitions', () => {
  const [generic] = counterpartyEntity.make({
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    accountingEntityId: generateUUID(),
    name: 'Party',
    type: 'organization',
  });
  const address = addressValue.make({
    line1: 'Main Street',
    city: 'Lagos',
    countryCode: 'NG',
  });

  it('adds multiple roles in stable order while preserving previous details and identity', () => {
    const [contractor] = counterpartyEntity.addRole(generic, {
      role: 'contractor',
      meta: { address },
    });
    const [employer] = counterpartyEntity.addRole(contractor, {
      role: 'employer',
      meta: { displayName: null, address },
    });
    expect(employer.roles).toEqual(['employer', 'contractor']);
    expect(employer.id).toBe(generic.id);
    expect(employer.createdAt).toBe(generic.createdAt);
    expect(employer.meta.contractor).toEqual(contractor.meta.contractor);
    expect(contractor.meta.employer).toBeUndefined();
    expect(Object.isFrozen(employer.meta)).toBe(true);
    expect(Object.isFrozen(employer.meta.employer?.address)).toBe(true);
  });

  it.each(['vendor', 'employer'])(
    'rejects inconsistent membership %j',
    (role) => {
      const invalid = { ...generic, roles: [role] } as unknown as Parameters<
        typeof counterpartyEntity.validateCounterparty
      >[0];
      expect(() => counterpartyEntity.validateCounterparty(invalid)).toThrow(
        counterpartyError.InvalidRole
      );
    }
  );

  it('rejects wrong roles and duplicate roles even when metadata counts look plausible', () => {
    const [vendor] = counterpartyEntity.addRole(generic, {
      role: 'vendor',
      meta: { address: null },
    });
    expect(() =>
      counterpartyEntity.validateCounterparty({
        ...vendor,
        roles: ['employer'],
      })
    ).toThrow(counterpartyError.InvalidRole);
    const [both] = counterpartyEntity.addRole(vendor, {
      role: 'contractor',
      meta: { address },
    });
    expect(() =>
      counterpartyEntity.validateCounterparty({
        ...both,
        roles: ['vendor', 'vendor'],
      })
    ).toThrow(counterpartyError.InvalidRole);
  });
});

describe('counterparty entity updates', () => {
  const make = () =>
    counterpartyEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      accountingEntityId: 'a1111111-1111-4111-8111-111111111112' as TEntityId,
      name: 'Draft',
      type: 'individual',
      status: 'draft',
    })[0];

  it('owns the activation transition and preserves creation identity', () => {
    const before = make();
    const [after, events, audit] = counterpartyEntity.update(before, {
      status: 'active',
    });
    expect(after).toMatchObject({
      id: before.id,
      createdBy: before.createdBy,
      createdAt: before.createdAt,
      status: 'active',
    });
    expect(before.status).toBe('draft');
    expect(before.version).toBe(1);
    expect(after.version).toBe(2);
    expect(audit.entityVersion).toBe(2);
    expect(events[0].type).toBe('domain:counterparty:activated');
    expect(audit.action).toBe('activated');
    expect(() =>
      counterpartyEntity.update(after, { status: 'active' })
    ).toThrow(counterpartyError.AlreadyActive);
  });

  it.each([0, -1, 1.5, NaN, Infinity, undefined])(
    'rejects invalid source version %p without mutation',
    (version) => {
      const before = { ...make(), version: version as number };
      expect(() =>
        counterpartyEntity.update(before, { status: 'active' })
      ).toThrow(counterpartyError.InvalidVersion);
      expect(() =>
        counterpartyEntity.addRole(before, {
          role: 'vendor',
          meta: { address: null },
        })
      ).toThrow(counterpartyError.InvalidVersion);
      expect(before.status).toBe('draft');
      expect(before.version).toBe(version);
    }
  );

  it('increments once for an edit containing both corrections and activation', () => {
    const before = make();
    const [active, , activationAudit] = counterpartyEntity.update(before, {
      name: 'Completed',
      type: 'organization',
      status: 'active',
      meta: { vendor: { address: null } },
    });
    expect(active.version).toBe(before.version + 1);
    expect(activationAudit.entityVersion).toBe(active.version);
    const [edited, , editAudit] = counterpartyEntity.update(active, {
      name: 'Edited',
    });
    expect(edited.version).toBe(active.version + 1);
    expect(editAudit.entityVersion).toBe(edited.version);
    expect(active.name).toBe('Completed');
  });

  it('rejects invalid replacement metadata before deriving roles', () => {
    expect(() =>
      counterpartyEntity.update(make(), { meta: [] as never })
    ).toThrow(counterpartyError.InvalidMeta);
  });

  it('rejects an invalid source even when the requested changes would repair it', () => {
    const before = { ...make(), roles: ['vendor'] as const };

    expect(() =>
      counterpartyEntity.update(
        { ...before, roles: [...before.roles] },
        { meta: { vendor: { address: null } } }
      )
    ).toThrow(counterpartyError.InvalidRole);
  });

  it('rejects a missing source with the counterparty entity error', () => {
    expect(() =>
      counterpartyEntity.update(null as never, { status: 'active' })
    ).toThrow(counterpartyError.InvalidCounterpartyEntity);
  });

  it('validates a changed type before constructing the next version', () => {
    const before = make();

    expect(() =>
      counterpartyEntity.update(before, { type: 'invalid' as never })
    ).toThrow(counterpartyError.InvalidType);

    const [after] = counterpartyEntity.update(before, { type: 'organization' });
    expect(after.type).toBe('organization');
    expect(after.version).toBe(before.version + 1);
    expect(before.type).toBe('individual');
  });

  it('rejects a no-change update before timestamping', () => {
    expect(() => counterpartyEntity.update(make(), {})).toThrow(
      counterpartyError.InvalidUpdate
    );
  });
});
