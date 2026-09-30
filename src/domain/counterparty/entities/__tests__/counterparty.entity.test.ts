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
