import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import accountingContextEntity from '@domain/accounting/entities/accounting-context.entity';
import getAccountingContextDescription from '@domain/accounting/entities/helpers/get-description.helper';
import getAccountingJurisdiction from '@domain/accounting/entities/helpers/get-jurisdiction.helper';
import getAccountingStandard from '@domain/accounting/entities/helpers/get-standard.helper';
import accountingContextValidation from '@domain/accounting/entities/validations/accounting-context.validation';
import accountingError from '@domain/accounting/errors/accounting.error';
import { EAccountingContextEvents } from '@domain/accounting/events/accounting-context.events';
import { EAccountingContextActions } from '@domain/accounting/types/accounting-context-audit.types';
import {
  EAccountingEntityType,
  UAccountingEntityType,
} from '@domain/accounting/types/accounting-entity.types';

describe('accountingContextEntity', () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  const validPayload = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    name: 'Primary Ledger',
    description: 'The primary US GAAP ledger',
    accountingEntityId: '123e4567-e89b-12d3-a456-426614174000' as TEntityId,
    accountingStandardCode: 'IFRS',
    fiscalYearId: '123e4567-e89b-12d3-a456-426614174001' as TEntityId,
    currentAccountingPeriodId:
      '123e4567-e89b-12d3-a456-426614174002' as TEntityId,
    previousAccountingPeriodId: null,
    nextAccountingPeriodId: null,
  } as const;

  describe('isValidAccountingStandardCode', () => {
    it('returns true for a valid accounting standard code', () => {
      expect(
        accountingContextValidation.isValidAccountingStandardCode('IFRS')
      ).toBe(true);
      expect(
        accountingContextValidation.isValidAccountingStandardCode('US_GAAP')
      ).toBe(true);
    });

    it('returns false for an invalid accounting standard code', () => {
      expect(
        accountingContextValidation.isValidAccountingStandardCode('INVALID')
      ).toBe(false);
      expect(
        accountingContextValidation.isValidAccountingStandardCode(123)
      ).toBe(false);
      expect(
        accountingContextValidation.isValidAccountingStandardCode(null)
      ).toBe(false);
    });
  });

  describe('validateAccountingStandardCode', () => {
    it('does not throw for a valid accounting standard code', () => {
      expect(() =>
        accountingContextValidation.validateAccountingStandardCode('IFRS')
      ).not.toThrow();
    });

    it('throws AppError for an invalid accounting standard code', () => {
      expect(() =>
        accountingContextValidation.validateAccountingStandardCode('INVALID')
      ).toThrow();
    });
  });

  describe('getAccountingContextDescription', () => {
    it('returns sanitized description if provided', () => {
      expect(getAccountingContextDescription('  Valid description  ')).toBe(
        'Valid description'
      );
    });

    it('returns null if description is null', () => {
      expect(getAccountingContextDescription(null)).toBeNull();
    });
  });

  describe('getAccountingJurisdiction', () => {
    it('returns jurisdiction for a valid code', () => {
      const jurisdiction = getAccountingJurisdiction('US');
      expect(jurisdiction.code).toBe('US');
    });

    it('throws InvalidJurisdiction if code is empty', () => {
      expect(() => getAccountingJurisdiction('')).toThrow();
    });

    it('throws InvalidJurisdiction if code is invalid', () => {
      expect(() => getAccountingJurisdiction('INVALID_CODE')).toThrow();
    });
  });

  describe('validateStandardCode', () => {
    it('does not throw for a valid standard code', () => {
      expect(() =>
        accountingContextValidation.validateStandardCode('US_GAAP')
      ).not.toThrow();
    });

    it('throws InvalidStandard if code is empty', () => {
      expect(() =>
        accountingContextValidation.validateStandardCode('' as never)
      ).toThrow();
    });

    it('throws InvalidStandard if code is invalid', () => {
      expect(() =>
        // @ts-expect-error testing invalid standard code
        accountingContextValidation.validateStandardCode('INVALID_CODE')
      ).toThrow();
    });
  });

  describe('getAccountingStandard', () => {
    it('returns standard for a valid code', () => {
      const standard = getAccountingStandard('US_GAAP');
      expect(standard.code).toBe('US_GAAP');
    });

    it('throws InvalidStandard if code is invalid', () => {
      // @ts-expect-error testing invalid standard code
      expect(() => getAccountingStandard('INVALID')).toThrow();
    });
  });

  describe('validateStandardCodeAndJurisdiction', () => {
    it('does not throw for valid standard, jurisdiction, and entity type combination', () => {
      expect(() =>
        accountingContextValidation.validateStandardCodeAndJurisdiction(
          'US_GAAP',
          'US',
          'individual'
        )
      ).not.toThrow();
    });

    it('throws InvalidStandard if entity type has no standard in the jurisdiction (not included)', () => {
      // Assuming 'Personal' might not support 'US_GAAP' or we can mock/pass an unsupported combination.
      // E.g. what if we pass 'IFRS' to 'US' if not allowed? Let's test an invalid standard for a valid jurisdiction
      expect(() =>
        accountingContextValidation.validateStandardCodeAndJurisdiction(
          'IFRS',
          'US',
          'individual'
        )
      ).toThrow();
    });

    it('throws InvalidStandard if availableStandards is undefined for the given entity type', () => {
      // Temporarily bypass validateType by adding a property to EAccountingEntityType
      // This allows us to test the case where a valid entity type has no configured standards in the jurisdiction
      const testType = 'test_type' as UAccountingEntityType;
      const mutableEntityTypes = EAccountingEntityType as unknown as Record<
        string,
        UAccountingEntityType
      >;
      mutableEntityTypes.Test = testType;

      try {
        expect(() =>
          accountingContextValidation.validateStandardCodeAndJurisdiction(
            'US_GAAP',
            'US',
            testType
          )
        ).toThrow();
      } finally {
        // Clean up the temporary property
        delete mutableEntityTypes.Test;
      }
    });
  });

  describe('make', () => {
    it('preserves previous and next period references in the entity, event, and audit', () => {
      const previousAccountingPeriodId =
        '123e4567-e89b-12d3-a456-426614174003' as TEntityId;
      const nextAccountingPeriodId =
        '123e4567-e89b-12d3-a456-426614174004' as TEntityId;
      const [entity, events, audit] = accountingContextEntity.make({
        ...validPayload,
        previousAccountingPeriodId,
        nextAccountingPeriodId,
      });

      expect(entity.previousAccountingPeriodId).toBe(
        previousAccountingPeriodId
      );
      expect(entity.nextAccountingPeriodId).toBe(nextAccountingPeriodId);
      expect(events[0].data).toEqual(entity);
      expect(audit.diff.after).toEqual(entity);
      expect(Object.isFrozen(entity)).toBe(true);
    });

    it.each([
      [
        'previousAccountingPeriodId',
        accountingError.InvalidPreviousAccountingPeriodId,
      ],
      ['nextAccountingPeriodId', accountingError.InvalidNextAccountingPeriodId],
    ] as const)('rejects an invalid %s', (field, ErrorType) => {
      expect(() =>
        accountingContextEntity.make({
          ...validPayload,
          [field]: 'invalid-uuid' as TEntityId,
        })
      ).toThrow(ErrorType);
    });

    it('creates a valid accounting context entity with events', () => {
      const [entity, events, audit] =
        accountingContextEntity.make(validPayload);

      expect(entity).toEqual({
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id: expect.any(String),
        name: validPayload.name,
        description: validPayload.description,
        accountingEntityId: validPayload.accountingEntityId,
        accountingStandardCode: validPayload.accountingStandardCode,
        fiscalYearId: validPayload.fiscalYearId,
        currentAccountingPeriodId: validPayload.currentAccountingPeriodId,
        previousAccountingPeriodId: null,
        nextAccountingPeriodId: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
        closedAt: null,
      });
      expect(Object.isFrozen(entity)).toBe(true);

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: EAccountingContextEvents.Created,
        data: entity,
      });

      expect(audit).toEqual({
        entityId: entity.id,
        entityVersion: 1,
        action: EAccountingContextActions.Created,
        diff: {
          before: null,
          after: entity,
        },
        occurredAt: entity.updatedAt,
      });
      expect(Object.isFrozen(audit)).toBe(true);
    });

    it('throws AppError if accountingEntityId is invalid', () => {
      const invalidPayload = {
        ...validPayload,
        accountingEntityId: 'invalid-uuid',
      };
      // @ts-expect-error testing invalid UUID
      expect(() => accountingContextEntity.make(invalidPayload)).toThrow(
        accountingError.InvalidAccountingEntityId
      );
    });

    it('throws AppError if accountingStandardCode is invalid', () => {
      const invalidPayload = {
        ...validPayload,
        accountingStandardCode: 'INVALID',
      };
      // @ts-expect-error testing invalid accountingStandardCode
      expect(() => accountingContextEntity.make(invalidPayload)).toThrow();
    });

    it('throws AppError if fiscalYearId is invalid', () => {
      const invalidPayload = {
        ...validPayload,
        fiscalYearId: 'invalid-uuid',
      };
      // @ts-expect-error testing invalid UUID
      expect(() => accountingContextEntity.make(invalidPayload)).toThrow(
        accountingError.InvalidFiscalYearId
      );
    });

    it('throws AppError if currentAccountingPeriodId is invalid', () => {
      const invalidPayload = {
        ...validPayload,
        currentAccountingPeriodId: 'invalid-uuid',
      };
      // @ts-expect-error testing invalid UUID
      expect(() => accountingContextEntity.make(invalidPayload)).toThrow(
        accountingError.InvalidCurrentAccountingPeriodId
      );
    });

    it('throws AppError if name is invalid', () => {
      const invalidPayload = {
        ...validPayload,
        name: '',
      };
      expect(() => accountingContextEntity.make(invalidPayload)).toThrow(
        accountingError.InvalidName
      );
    });

    it('throws AppError if description is invalid', () => {
      const invalidPayload = {
        ...validPayload,
        description: '',
      };
      expect(() => accountingContextEntity.make(invalidPayload)).toThrow(
        accountingError.InvalidDescription
      );
    });

    it('creates a valid accounting context entity with a null description', () => {
      const validPayloadWithNullDescription = {
        ...validPayload,
        description: null,
      };
      const [entity] = accountingContextEntity.make(
        validPayloadWithNullDescription
      );

      expect(entity.description).toBeNull();
    });
  });
});

describe('accountingContextEntity.update', () => {
  const currentId = generateUUID();
  const nextId = generateUUID();
  const followingId = generateUUID();
  const [context] = accountingContextEntity.make({
    createdBy: generateUUID(),
    accountingEntityId: generateUUID(),
    fiscalYearId: generateUUID(),
    currentAccountingPeriodId: currentId,
    previousAccountingPeriodId: null,
    nextAccountingPeriodId: nextId,
    accountingStandardCode: 'IFRS',
    name: 'Working context',
    description: null,
  });

  it.each([followingId, null])(
    'returns the updated entity, event and audit, next=%s',
    (following) => {
      const [updated, events, audit] = accountingContextEntity.update(context, {
        previousAccountingPeriodId: currentId,
        currentAccountingPeriodId: nextId,
        nextAccountingPeriodId: following,
      });
      expect(updated).toEqual({
        ...context,
        currentAccountingPeriodId: nextId,
        previousAccountingPeriodId: currentId,
        nextAccountingPeriodId: following,
        updatedAt: expect.any(Date),
      });
      expect(context.currentAccountingPeriodId).toBe(currentId);
      expect(Object.isFrozen(updated)).toBe(true);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(EAccountingContextEvents.Updated);
      expect(events[0].data).toBe(updated);
      expect(audit).toMatchObject({
        entityId: context.id,
        action: EAccountingContextActions.Updated,
        occurredAt: updated.updatedAt,
        diff: {
          before: {
            currentAccountingPeriodId: currentId,
            previousAccountingPeriodId: null,
            nextAccountingPeriodId: nextId,
          },
          after: {
            currentAccountingPeriodId: nextId,
            previousAccountingPeriodId: currentId,
            nextAccountingPeriodId: following,
          },
        },
      });
      expect(Object.isFrozen(audit)).toBe(true);
    }
  );

  it.each([
    {},
    {
      currentAccountingPeriodId: currentId,
      previousAccountingPeriodId: null,
      nextAccountingPeriodId: nextId,
    },
  ])(
    'returns the original entity without events or audit for unchanged input',
    (changes) => {
      const [updated, events, audit] = accountingContextEntity.update(
        context,
        changes
      );
      expect(updated).toBe(context);
      expect(updated.updatedAt).toBe(context.updatedAt);
      expect(events).toEqual([]);
      expect(audit).toBeNull();
    }
  );

  it('returns no effects when the same update is repeated', () => {
    const changes = {
      previousAccountingPeriodId: currentId,
      currentAccountingPeriodId: nextId,
      nextAccountingPeriodId: null,
    };
    const [updated] = accountingContextEntity.update(context, changes);
    const [repeated, events, audit] = accountingContextEntity.update(
      updated,
      changes
    );
    expect(repeated).toBe(updated);
    expect(events).toEqual([]);
    expect(audit).toBeNull();
  });

  it('supports partial updates and explicit null for nullable period references', () => {
    const [updated] = accountingContextEntity.update(context, {
      previousAccountingPeriodId: currentId,
    });
    expect(updated.currentAccountingPeriodId).toBe(currentId);
    expect(updated.nextAccountingPeriodId).toBe(nextId);
    const [cleared, events, audit] = accountingContextEntity.update(updated, {
      previousAccountingPeriodId: null,
      nextAccountingPeriodId: null,
    });
    expect(cleared.previousAccountingPeriodId).toBeNull();
    expect(cleared.nextAccountingPeriodId).toBeNull();
    expect(events).toHaveLength(1);
    expect(audit?.action).toBe(EAccountingContextActions.Updated);
  });

  it.each([
    {
      changes: { name: '  Renamed context  ' },
      after: { name: 'Renamed context' },
    },
    {
      changes: { description: '  Updated description  ' },
      after: { description: 'Updated description' },
    },
  ])('updates and audits $after independently', ({ changes, after }) => {
    const [updated, events, audit] = accountingContextEntity.update(
      context,
      changes
    );

    expect(updated).toEqual({
      ...context,
      ...after,
      updatedAt: expect.any(Date),
    });
    expect(Object.isFrozen(updated)).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe(EAccountingContextEvents.Updated);
    expect(events[0].data).toBe(updated);
    expect(audit).toMatchObject({
      action: EAccountingContextActions.Updated,
      diff: { after },
    });
    expect(context.name).toBe('Working context');
    expect(context.description).toBeNull();
  });

  it('clears an existing description and audits the change', () => {
    const [described] = accountingContextEntity.update(context, {
      description: 'Existing description',
    });
    const [cleared, events, audit] = accountingContextEntity.update(described, {
      description: null,
    });

    expect(cleared.description).toBeNull();
    expect(cleared.name).toBe(described.name);
    expect(described.description).toBe('Existing description');
    expect(events).toHaveLength(1);
    expect(events[0].data).toBe(cleared);
    expect(audit?.diff).toMatchObject({
      before: { description: 'Existing description' },
      after: { description: null },
    });
  });

  it.each([
    {},
    { name: 'Renamed context', description: 'Updated description' },
    { name: '  Renamed context  ', description: '  Updated description  ' },
    { name: undefined, description: undefined },
  ])('returns no effects for unchanged name and description: %j', (changes) => {
    const [updated] = accountingContextEntity.update(context, {
      name: 'Renamed context',
      description: 'Updated description',
    });
    const [unchanged, events, audit] = accountingContextEntity.update(
      updated,
      changes
    );

    expect(unchanged).toBe(updated);
    expect(unchanged.updatedAt).toBe(updated.updatedAt);
    expect(events).toEqual([]);
    expect(audit).toBeNull();
  });

  it.each([
    ['name', '', accountingError.InvalidName],
    ['name', '   ', accountingError.InvalidName],
    ['name', 'a'.repeat(151), accountingError.InvalidName],
    ['description', '', accountingError.InvalidDescription],
    ['description', '   ', accountingError.InvalidDescription],
    ['description', 'a'.repeat(256), accountingError.InvalidDescription],
  ] as const)('rejects invalid %s value %j', (field, value, error) => {
    expect(() =>
      accountingContextEntity.update(context, { [field]: value })
    ).toThrow(error);
  });

  it.each([
    [
      'currentAccountingPeriodId',
      accountingError.InvalidCurrentAccountingPeriodId,
    ],
    [
      'previousAccountingPeriodId',
      accountingError.InvalidPreviousAccountingPeriodId,
    ],
    ['nextAccountingPeriodId', accountingError.InvalidNextAccountingPeriodId],
  ] as const)('rejects invalid %s', (field, error) => {
    expect(() =>
      accountingContextEntity.update(context, {
        [field]: 'invalid' as TEntityId,
      })
    ).toThrow(error);
  });
});
