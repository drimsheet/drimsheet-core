import * as schemas from '@app/reporting/dtos/balance-series/balance-series.dto.validation';

const period = { from: '2026-01-01', to: '2026-01-31', bucketDays: 7 };

describe('balance series query validation', () => {
  describe('types', () => {
    const schema = schemas.getBalancesByTypeQueryValidationSchema;
    it('accepts the specific filter', () => {
      expect(schema.safeParse({ ...period, types: ['asset'] }).success).toBe(
        true
      );
    });
    it.each([undefined, [], ['invalid'], 'asset'])(
      'rejects malformed filters %j',
      (filter) => {
        expect(schema.safeParse({ ...period, types: filter }).success).toBe(
          false
        );
      }
    );
    it.each([
      { from: '2026-02-30' },
      { to: '0000-01-01' },
      { bucketDays: 0 },
      { bucketDays: 1.5 },
      { bucketDays: Infinity },
    ])('rejects malformed dates and bucket sizes %j', (invalid) => {
      expect(
        schema.safeParse({ ...period, types: ['asset'], ...invalid }).success
      ).toBe(false);
    });
  });
  describe('subTypes', () => {
    const schema = schemas.getBalancesBySubTypeQueryValidationSchema;
    it('accepts the specific filter', () => {
      expect(
        schema.safeParse({ ...period, subTypes: ['suspense'] }).success
      ).toBe(true);
    });
    it.each([undefined, [], ['invalid'], 'suspense'])(
      'rejects malformed filters %j',
      (filter) => {
        expect(schema.safeParse({ ...period, subTypes: filter }).success).toBe(
          false
        );
      }
    );
    it.each([
      { from: '2026-02-30' },
      { to: '0000-01-01' },
      { bucketDays: 0 },
      { bucketDays: 1.5 },
      { bucketDays: Infinity },
    ])('rejects malformed dates and bucket sizes %j', (invalid) => {
      expect(
        schema.safeParse({ ...period, subTypes: ['suspense'], ...invalid })
          .success
      ).toBe(false);
    });
  });
  describe('behaviors', () => {
    const schema = schemas.getBalancesByBehaviorQueryValidationSchema;
    it('accepts the specific filter', () => {
      expect(schema.safeParse({ ...period, behaviors: ['bank'] }).success).toBe(
        true
      );
    });
    it.each([undefined, [], ['some_behavior'], 'bank'])(
      'rejects malformed filters %j',
      (filter) => {
        expect(schema.safeParse({ ...period, behaviors: filter }).success).toBe(
          false
        );
      }
    );
    it.each([
      { from: '2026-02-30' },
      { to: '0000-01-01' },
      { bucketDays: 0 },
      { bucketDays: 1.5 },
      { bucketDays: Infinity },
    ])('rejects malformed dates and bucket sizes %j', (invalid) => {
      expect(
        schema.safeParse({ ...period, behaviors: ['bank'], ...invalid }).success
      ).toBe(false);
    });
  });
  describe('accountIds', () => {
    const schema = schemas.getBalancesByAccountQueryValidationSchema;
    it('accepts the specific filter', () => {
      expect(
        schema.safeParse({
          ...period,
          accountIds: ['123e4567-e89b-12d3-a456-426614174001'],
        }).success
      ).toBe(true);
    });
    it.each([
      undefined,
      [],
      ['invalid'],
      '123e4567-e89b-12d3-a456-426614174001',
    ])('rejects malformed filters %j', (filter) => {
      expect(schema.safeParse({ ...period, accountIds: filter }).success).toBe(
        false
      );
    });
    it.each([
      { from: '2026-02-30' },
      { to: '0000-01-01' },
      { bucketDays: 0 },
      { bucketDays: 1.5 },
      { bucketDays: Infinity },
    ])('rejects malformed dates and bucket sizes %j', (invalid) => {
      expect(
        schema.safeParse({
          ...period,
          accountIds: ['123e4567-e89b-12d3-a456-426614174001'],
          ...invalid,
        }).success
      ).toBe(false);
    });
  });
});
