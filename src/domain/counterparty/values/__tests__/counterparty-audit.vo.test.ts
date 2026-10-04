import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';
import historyError from '@shared/values/history/history.error';

import counterpartyEntity from '@domain/counterparty/entities/counterparty.entity';
import counterpartyError from '@domain/counterparty/errors/counterparty.error';
import {
  ECounterpartyEntityActions,
  IMakeCounterpartyAuditPayload,
} from '@domain/counterparty/types/counterparty-audit.types';
import {
  ECounterpartyStatus,
  ECounterpartyType,
  ICounterparty,
} from '@domain/counterparty/types/counterparty.types';
import counterpartyAuditValue from '@domain/counterparty/values/counterparty-audit.vo';

describe('counterpartyAuditValue', () => {
  const counterpartyId = generateUUID();
  const accountingEntityId = generateUUID();

  const mockCounterparty: ICounterparty = Object.freeze({
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: counterpartyId,
    accountingEntityId,
    name: 'Acme Corp',
    status: ECounterpartyStatus.Active,
    type: ECounterpartyType.Organization,
    meta: {},
    roles: [],
    version: 1,
    createdAt: new Date('2026-07-31T12:00:00.000Z'),
    updatedAt: new Date('2026-07-31T12:00:00.000Z'),
  });

  describe('make', () => {
    it('should create audit record for creation action', () => {
      const audit = counterpartyAuditValue.make({
        before: null,
        after: mockCounterparty,
        action: ECounterpartyEntityActions.Created,
      });

      expect(audit.entityId).toBe(counterpartyId);
      expect(audit.action).toBe(ECounterpartyEntityActions.Created);
      expect(audit.diff.before).toBeNull();
      expect(audit.diff.after).toEqual(mockCounterparty);
      expect(audit.occurredAt).toEqual(mockCounterparty.updatedAt);
      expect(Object.isFrozen(audit)).toBe(true);
    });

    it.each([
      null,
      'invalid-payload',
      { before: null, action: ECounterpartyEntityActions.Created },
    ])('should throw InvalidCounterpartyPayload for %p', (payload) => {
      expect(() =>
        counterpartyAuditValue.make(
          payload as unknown as IMakeCounterpartyAuditPayload
        )
      ).toThrow(counterpartyError.InvalidCounterpartyPayload);
    });

    it('accepts the archived action for a counterparty transition', () => {
      const [before] = counterpartyEntity.make({
        createdBy: generateUUID(),
        accountingEntityId: generateUUID(),
        name: 'Archive audit',
        type: 'individual',
      });
      const [after] = counterpartyEntity.archive(before);
      const audit = counterpartyAuditValue.make({
        before,
        after,
        action: ECounterpartyEntityActions.Archived,
      });
      expect(audit.action).toBe('archived');
      expect(audit.entityVersion).toBe(after.version);
      expect(audit.diff).toMatchObject({
        before: { status: 'active' },
        after: { status: 'archived' },
      });
    });

    it('uses the resulting entity version in the audit', () => {
      const audit = counterpartyAuditValue.make({
        before: mockCounterparty,
        after: { ...mockCounterparty, version: 2, name: 'Changed' },
        action: ECounterpartyEntityActions.Updated,
      });
      expect(audit.entityVersion).toBe(2);
    });

    it('rejects an invalid entity version', () => {
      expect(() =>
        counterpartyAuditValue.make({
          before: null,
          after: { ...mockCounterparty, version: 0 },
          action: ECounterpartyEntityActions.Created,
        })
      ).toThrow(counterpartyError.InvalidVersion);
    });

    it('should throw InvalidDiff if before and after are identical', () => {
      expect(() =>
        counterpartyAuditValue.make({
          before: mockCounterparty,
          after: mockCounterparty,
          action: ECounterpartyEntityActions.RoleAdded,
        })
      ).toThrow(historyError.InvalidDiff);
    });

    it('should throw InvalidCounterpartyId if after entity has invalid id', () => {
      const invalidEntity: ICounterparty = Object.freeze({
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id: 'invalid-id' as TEntityId,
        accountingEntityId: mockCounterparty.accountingEntityId,
        name: mockCounterparty.name,
        status: mockCounterparty.status,
        type: mockCounterparty.type,
        meta: {},
        roles: mockCounterparty.roles,
        version: 1,
        createdAt: mockCounterparty.createdAt,
        updatedAt: mockCounterparty.updatedAt,
      });

      expect(() =>
        counterpartyAuditValue.make({
          before: null,
          after: invalidEntity,
          action: ECounterpartyEntityActions.Created,
        })
      ).toThrow(counterpartyError.InvalidCounterpartyId);
    });
  });
});
