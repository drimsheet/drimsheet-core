import { TCreationOmits } from '@shared/types/creation-omits.types';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import accountingEntityValidation from '@domain/accounting/entities/validations/accounting-entity.validation';
import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';
import { EAccountingEntityEvents } from '@domain/accounting/events/accounting-entity.events';
import { EAccountingEntityActions } from '@domain/accounting/types/accounting-entity-audit.types';
import {
  EAccountingEntityHistoryAction,
  EAccountingEntityType,
  IAccountingEntity,
} from '@domain/accounting/types/accounting-entity.types';

describe('accountingEntityEntity', () => {
  const MOCK_DATE = new Date('2026-04-01T00:00:00.000Z');
  let validPayload: TCreationOmits<IAccountingEntity, 'status'>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(MOCK_DATE);

    validPayload = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      name: 'Test Accounting Entity',
      type: EAccountingEntityType.Individual,
      ownerId: generateUUID(),
      functionalCurrencyCode: 'NGN',
      jurisdictionCode: 'NG',
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('delete', () => {
    it('returns the unchanged entity snapshot, a deletion event, and no audit', () => {
      const [current] = accountingEntityEntity.make(validPayload);
      jest.setSystemTime(new Date('2026-04-02T00:00:00Z'));
      const [deletedEntity, deleteEvent, audit] =
        accountingEntityEntity.delete(current);
      expect(deletedEntity).toBe(current);
      expect(Object.isFrozen(deletedEntity)).toBe(true);
      expect(deleteEvent).toMatchObject({
        type: EAccountingEntityEvents.Deleted,
        data: current,
        occurredAt: new Date(),
      });
      expect(Object.isFrozen(deleteEvent)).toBe(true);
      expect(audit).toBeNull();
      expect(current.updatedAt).toEqual(MOCK_DATE);
    });
  });

  describe('archive', () => {
    it('preserves identity and books while auditing the archive transition (ACC-AE-007)', () => {
      const [current] = accountingEntityEntity.make(validPayload);
      expect(current.status).toBe('active');
      jest.setSystemTime(new Date('2026-04-02T00:00:00Z'));
      const [archived, events, audit] = accountingEntityEntity.archive(current);
      expect(archived).toEqual({
        ...current,
        status: 'archived',
        updatedAt: new Date(),
      });
      expect(Object.isFrozen(archived)).toBe(true);
      expect(current.status).toBe('active');
      expect(events).toEqual([
        expect.objectContaining({
          type: EAccountingEntityEvents.Archived,
          data: archived,
        }),
      ]);
      expect(audit).toMatchObject({
        action: 'archived',
        diff: {
          before: expect.objectContaining({ status: 'active' }),
          after: expect.objectContaining({ status: 'archived' }),
        },
      });
    });

    it('returns the identical archived entity with no audit or events on repetition', () => {
      const [current] = accountingEntityEntity.make(validPayload);
      const [archived] = accountingEntityEntity.archive(current);
      jest.setSystemTime(new Date('2026-04-03T00:00:00Z'));
      const [unchanged, events, audit] =
        accountingEntityEntity.archive(archived);
      expect(unchanged).toBe(archived);
      expect(events).toEqual([]);
      expect(audit).toBeNull();
    });

    it('rejects changes to archived entities while retaining valid no-op semantics', () => {
      const [current] = accountingEntityEntity.make(validPayload);
      const [archived] = accountingEntityEntity.archive(current);
      expect(() =>
        accountingEntityEntity.update(archived, { name: 'Changed' })
      ).toThrow(accountingEntityError.Archived);
      const [unchanged, events, audit] = accountingEntityEntity.update(
        archived,
        {}
      );
      expect(unchanged).toBe(archived);
      expect(events).toEqual([]);
      expect(audit).toBeNull();
    });
  });

  describe('update', () => {
    it('updates allowed fields, preserves identity, and emits an audit and event', () => {
      const [current] = accountingEntityEntity.make({
        ...validPayload,
        type: 'sole_trader',
      });
      jest.setSystemTime(new Date('2026-04-02T00:00:00Z'));
      const [updated, events, audit] = accountingEntityEntity.update(current, {
        name: '  Renamed  ',
        type: 'private_company',
        functionalCurrencyCode: 'USD',
      });
      expect(updated).toEqual({
        ...current,
        name: 'Renamed',
        type: 'private_company',
        functionalCurrencyCode: 'USD',
        updatedAt: new Date(),
      });
      expect(Object.isFrozen(updated)).toBe(true);
      expect(current.name).toBe(validPayload.name);
      expect(events).toEqual([
        expect.objectContaining({
          type: EAccountingEntityEvents.Updated,
          data: updated,
        }),
      ]);
      expect(audit).toMatchObject({
        action: 'updated',
        entityId: current.id,
        diff: {
          before: expect.objectContaining({ name: current.name }),
          after: expect.objectContaining({ name: 'Renamed' }),
        },
      });
    });

    it.each([
      {},
      { name: '  Test Accounting Entity  ' },
      { type: 'individual' as const },
      { functionalCurrencyCode: 'NGN' as const },
    ])(
      'returns the same entity without events or audit for no-op %j',
      (changes) => {
        const [current] = accountingEntityEntity.make(validPayload);
        const [updated, events, audit] = accountingEntityEntity.update(
          current,
          changes
        );
        expect(updated).toBe(current);
        expect(events).toEqual([]);
        expect(audit).toBeNull();
      }
    );

    it.each([
      ['individual', 'sole_trader'],
      ['individual', 'private_company'],
      ['sole_trader', 'individual'],
      ['private_company', 'sole_trader'],
      ['private_company', 'individual'],
    ] as const)('rejects %s -> %s', (before, after) => {
      const [current] = accountingEntityEntity.make({
        ...validPayload,
        type: before,
      });
      expect(() =>
        accountingEntityEntity.update(current, { type: after })
      ).toThrow(accountingEntityError.TypeChangeNotAllowed);
    });

    it.each(['', '   ', 'x'.repeat(101)])('rejects invalid name %j', (name) => {
      const [current] = accountingEntityEntity.make(validPayload);
      expect(() => accountingEntityEntity.update(current, { name })).toThrow(
        accountingEntityError.InvalidName
      );
    });

    it('rejects invalid currencies and entity types', () => {
      const [current] = accountingEntityEntity.make(validPayload);
      expect(() =>
        accountingEntityEntity.update(current, {
          // @ts-expect-error runtime validation
          functionalCurrencyCode: 'ZZZ',
        })
      ).toThrow();
      expect(() =>
        // @ts-expect-error runtime validation
        accountingEntityEntity.update(current, { type: 'invalid' })
      ).toThrow(accountingEntityError.InvalidType);
    });
  });

  describe('make', () => {
    it('should successfully create an accounting entity with valid payload', () => {
      const [entity, events, audit] = accountingEntityEntity.make(validPayload);

      expect(entity.id).toBeDefined();
      expect(typeof entity.id).toBe('string');
      expect(entity.name).toBe(validPayload.name);
      expect(entity.type).toBe(validPayload.type);
      expect(entity.ownerId).toBe(validPayload.ownerId);
      expect(entity.functionalCurrencyCode).toBe(
        validPayload.functionalCurrencyCode
      );
      expect(entity.jurisdictionCode).toBe(validPayload.jurisdictionCode);
      expect(entity.createdAt).toEqual(MOCK_DATE);
      expect(entity.updatedAt).toEqual(MOCK_DATE);

      expect(Object.isFrozen(entity)).toBe(true);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(EAccountingEntityEvents.Created);
      expect(events[0].data).toEqual(entity);

      expect(audit).toEqual({
        entityId: entity.id,
        entityVersion: 1,
        action: EAccountingEntityActions.Created,
        diff: {
          before: null,
          after: entity,
        },
        occurredAt: entity.updatedAt,
      });
      expect(Object.isFrozen(audit)).toBe(true);
    });

    it('should throw if invalid type is provided', () => {
      const invalidPayload = {
        ...validPayload,
        type: 'invalid-type',
      };

      // @ts-expect-error testing invalid type
      expect(() => accountingEntityEntity.make(invalidPayload)).toThrow();
    });

    it('should throw if invalid ownerId is provided', () => {
      const invalidPayload = {
        ...validPayload,
        ownerId: 'invalid-uuid',
      };

      // @ts-expect-error testing invalid ownerId type
      expect(() => accountingEntityEntity.make(invalidPayload)).toThrow(
        accountingEntityError.InvalidOwnerId
      );
    });

    it('should throw if name is too short', () => {
      const invalidPayload = {
        ...validPayload,
        name: '',
      };

      expect(() => accountingEntityEntity.make(invalidPayload)).toThrow(
        accountingEntityError.InvalidName
      );
    });

    it('should throw if name is missing', () => {
      const invalidPayload = {
        ...validPayload,
        name: undefined,
      };

      // @ts-expect-error testing missing property
      expect(() => accountingEntityEntity.make(invalidPayload)).toThrow(
        accountingEntityError.InvalidName
      );
    });
  });

  describe('helpers', () => {
    describe('isValidType', () => {
      it('should return true for valid entity types', () => {
        expect(
          accountingEntityValidation.isValidType(
            EAccountingEntityType.Individual
          )
        ).toBe(true);
        expect(
          accountingEntityValidation.isValidType(
            EAccountingEntityType.SoleTrader
          )
        ).toBe(true);
        expect(
          accountingEntityValidation.isValidType(
            EAccountingEntityType.PrivateCompany
          )
        ).toBe(true);
      });

      it('should return false for invalid entity type', () => {
        // @ts-expect-error testing invalid argument
        expect(accountingEntityValidation.isValidType('invalid-type')).toBe(
          false
        );
      });
    });

    describe('validateType', () => {
      it('should not throw for valid entity type', () => {
        expect(() =>
          accountingEntityValidation.validateType(
            EAccountingEntityType.Individual
          )
        ).not.toThrow();
      });

      it('should throw AppError for invalid entity type', () => {
        expect(() =>
          // @ts-expect-error testing invalid argument
          accountingEntityValidation.validateType('invalid-type')
        ).toThrow();
      });
    });

    describe('isValidJurisdictionCode', () => {
      it('returns true for a valid jurisdiction code', () => {
        expect(accountingEntityValidation.isValidJurisdictionCode('NG')).toBe(
          true
        );
        expect(accountingEntityValidation.isValidJurisdictionCode('US')).toBe(
          true
        );
      });

      it('returns false for an invalid jurisdiction code', () => {
        expect(
          accountingEntityValidation.isValidJurisdictionCode('INVALID')
        ).toBe(false);
        expect(accountingEntityValidation.isValidJurisdictionCode(123)).toBe(
          false
        );
        expect(accountingEntityValidation.isValidJurisdictionCode(null)).toBe(
          false
        );
      });
    });

    describe('validateJurisdictionCode', () => {
      it('does not throw for a valid jurisdiction code', () => {
        expect(() =>
          accountingEntityValidation.validateJurisdictionCode('NG')
        ).not.toThrow();
      });

      it('throws AppError for an invalid jurisdiction code', () => {
        expect(() =>
          accountingEntityValidation.validateJurisdictionCode('INVALID')
        ).toThrow();
      });
    });

    describe('isValidHistoryAction', () => {
      it('should return true for valid history actions', () => {
        expect(
          accountingEntityValidation.isValidHistoryAction(
            EAccountingEntityHistoryAction.Created
          )
        ).toBe(true);
        expect(
          accountingEntityValidation.isValidHistoryAction(
            EAccountingEntityHistoryAction.Updated
          )
        ).toBe(true);
      });

      it('should return false for invalid history action', () => {
        expect(
          // @ts-expect-error testing invalid argument
          accountingEntityValidation.isValidHistoryAction('invalid-action')
        ).toBe(false);
      });
    });

    describe('validateHistoryAction', () => {
      it('should not throw for valid history action', () => {
        expect(() =>
          accountingEntityValidation.validateHistoryAction(
            EAccountingEntityHistoryAction.Created
          )
        ).not.toThrow();
      });

      it('should throw AppError for invalid history action', () => {
        expect(() =>
          // @ts-expect-error testing invalid argument
          accountingEntityValidation.validateHistoryAction('invalid-action')
        ).toThrow();
      });
    });
  });
});
