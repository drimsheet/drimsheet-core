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
});

function makePayload(): Parameters<typeof accountingContextEntity.make>[0] {
  return {
    createdBy: generateUUID(),
    name: '  Primary context  ',
    description: '  Context description  ',
    accountingEntityId: generateUUID(),
    fiscalYearId: generateUUID(),
    accountingStandardCode: 'IFRS',
    accountingIntervalId: generateUUID(),
  };
}

describe('accountingContextEntity interval references', () => {
  const timestamp = new Date('2026-01-01T12:00:00Z');
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(timestamp);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates only the new context shape, with matching event and audit', () => {
    const payload = makePayload();
    const [context, events, audit] = accountingContextEntity.make(payload);
    expect(context).toEqual({
      ...payload,
      name: 'Primary context',
      description: 'Context description',
      id: expect.any(String),
      createdAt: timestamp,
      updatedAt: timestamp,
      closedAt: null,
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: EAccountingContextEvents.Created,
      data: context,
    });
    expect(audit).toEqual({
      entityId: context.id,
      entityVersion: 1,
      action: EAccountingContextActions.Created,
      diff: { before: null, after: context },
      occurredAt: timestamp,
    });
    expect(Object.isFrozen(context)).toBe(true);
    expect(Object.isFrozen(context.createdAt)).toBe(true);
    expect(Object.isFrozen(context.updatedAt)).toBe(true);
    expect(Object.isFrozen(audit)).toBe(true);
    expect(Object.isFrozen(accountingContextEntity)).toBe(true);
  });

  it('supports a null description', () => {
    const [context] = accountingContextEntity.make({
      ...makePayload(),
      description: null,
    });
    expect(context.description).toBeNull();
  });

  it.each([
    ['createdBy', accountingError.InvalidCreatedBy],
    ['accountingEntityId', accountingError.InvalidAccountingEntityId],
    ['fiscalYearId', accountingError.InvalidFiscalYearId],
    ['accountingIntervalId', accountingError.InvalidAccountingIntervalId],
  ] as const)('rejects an invalid %s on creation', (field, error) => {
    expect(() =>
      accountingContextEntity.make({
        ...makePayload(),
        [field]: 'bad' as TEntityId,
      })
    ).toThrow(error);
  });

  it.each([
    ['name', '', accountingError.InvalidName],
    ['name', ' '.repeat(5), accountingError.InvalidName],
    ['name', 'x'.repeat(151), accountingError.InvalidName],
    ['description', '', accountingError.InvalidDescription],
    ['description', 'x'.repeat(256), accountingError.InvalidDescription],
  ] as const)('rejects invalid %s content', (field, value, error) => {
    expect(() =>
      accountingContextEntity.make({ ...makePayload(), [field]: value })
    ).toThrow(error);
  });

  it('rejects an invalid accounting standard', () => {
    expect(() =>
      accountingContextEntity.make({
        ...makePayload(),
        accountingStandardCode: 'INVALID' as never,
      })
    ).toThrow();
  });

  it('changes the interval reference with an event and audit, preserving identity', () => {
    const [context] = accountingContextEntity.make(makePayload());
    const intervalId = generateUUID();
    jest.setSystemTime(new Date('2026-02-01'));
    const [updated, events, audit] = accountingContextEntity.update(context, {
      accountingIntervalId: intervalId,
    });
    expect(updated).toEqual({
      ...context,
      accountingIntervalId: intervalId,
      updatedAt: new Date('2026-02-01'),
    });
    expect(context.accountingIntervalId).not.toBe(intervalId);
    expect(updated.createdAt).toBe(context.createdAt);
    expect(Object.isFrozen(updated)).toBe(true);
    expect(Object.isFrozen(updated.updatedAt)).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: EAccountingContextEvents.Updated,
      data: updated,
    });
    expect(audit).toMatchObject({
      entityId: context.id,
      action: EAccountingContextActions.Updated,
      occurredAt: updated.updatedAt,
      diff: { before: context, after: updated },
    });
    const [repeated, repeatedEvents, repeatedAudit] =
      accountingContextEntity.update(updated, {
        accountingIntervalId: intervalId,
      });
    expect(repeated).toBe(updated);
    expect(repeated.updatedAt).toBe(updated.updatedAt);
    expect(repeatedEvents).toEqual([]);
    expect(repeatedAudit).toBeNull();
  });

  it('preserves identity and produces no effects for empty or identical updates', () => {
    const [context] = accountingContextEntity.make(makePayload());
    for (const changes of [
      {},
      { accountingIntervalId: context.accountingIntervalId },
      { accountingIntervalId: undefined },
    ]) {
      const [unchanged, events, audit] = accountingContextEntity.update(
        context,
        changes
      );
      expect(unchanged).toBe(context);
      expect(unchanged.updatedAt).toBe(context.updatedAt);
      expect(events).toEqual([]);
      expect(audit).toBeNull();
    }
  });

  it.each(['invalid', null])(
    'rejects invalid interval input %j before no-op detection',
    (intervalId) => {
      const [context] = accountingContextEntity.make(makePayload());
      expect(() =>
        accountingContextEntity.update(context, {
          accountingIntervalId: intervalId as TEntityId,
        })
      ).toThrow(accountingError.InvalidAccountingIntervalId);
      expect(() =>
        accountingContextEntity.update(
          { ...context, accountingIntervalId: intervalId as TEntityId },
          {}
        )
      ).toThrow(accountingError.InvalidAccountingIntervalId);
    }
  );

  it('updates and normalizes metadata without changing the interval', () => {
    const [context] = accountingContextEntity.make(makePayload());
    const [updated, events, audit] = accountingContextEntity.update(context, {
      name: '  Renamed context  ',
      description: '  New description  ',
    });
    expect(updated.name).toBe('Renamed context');
    expect(updated.description).toBe('New description');
    expect(updated.accountingIntervalId).toBe(context.accountingIntervalId);
    expect(events[0].data).toBe(updated);
    expect(audit?.diff.after).toMatchObject({
      name: 'Renamed context',
      description: 'New description',
    });
    const [cleared] = accountingContextEntity.update(updated, {
      description: null,
    });
    expect(cleared.description).toBeNull();
  });

  it.each([
    { name: 'Primary context', description: 'Context description' },
    { name: '  Primary context  ', description: '  Context description  ' },
    { name: undefined, description: undefined },
  ])('recognizes normalized unchanged metadata %j', (changes) => {
    const [context] = accountingContextEntity.make(makePayload());
    const [unchanged, events, audit] = accountingContextEntity.update(
      context,
      changes
    );
    expect(unchanged).toBe(context);
    expect(events).toEqual([]);
    expect(audit).toBeNull();
  });

  it.each([
    ['name', '', accountingError.InvalidName],
    ['name', '   ', accountingError.InvalidName],
    ['name', 'x'.repeat(151), accountingError.InvalidName],
    ['description', '', accountingError.InvalidDescription],
    ['description', '   ', accountingError.InvalidDescription],
    ['description', 'x'.repeat(256), accountingError.InvalidDescription],
  ] as const)('rejects invalid updated %s', (field, value, error) => {
    const [context] = accountingContextEntity.make(makePayload());
    expect(() =>
      accountingContextEntity.update(context, { [field]: value })
    ).toThrow(error);
  });
});
