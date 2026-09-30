import paginationError from '@shared/values/pagination/pagination.error';

import counterpartyError from '@domain/counterparty/errors/counterparty.error';

import {
  counterpartyCreateReqValidation,
  getCounterpartiesQueryValidationSchema,
} from '@app/counterparty/dtos/counterparty/counterparty.dto.validation';

const invalidNameKey = new counterpartyError.InvalidName().errorKey;
const invalidTypeKey = new counterpartyError.InvalidType().errorKey;
const invalidStatusKey = new counterpartyError.InvalidStatus().errorKey;

describe('Counterparty DTO validation', () => {
  const validPayload = {
    name: 'Acme Corp',
    status: 'active',
    type: 'organization',
  };

  describe('counterpartyCreateReqValidation', () => {
    it.each([
      { name: undefined },
      { name: ' ' },
      { type: undefined },
      { type: 'vendor' },
    ])('rejects incomplete draft input %j', (fields) => {
      expect(
        counterpartyCreateReqValidation.safeParse({
          ...validPayload,
          status: 'draft',
          ...fields,
        }).success
      ).toBe(false);
    });

    it.each(['draft', 'active', 'archived'])(
      'accepts creation status %s',
      (status) => {
        expect(
          counterpartyCreateReqValidation.safeParse({ ...validPayload, status })
            .success
        ).toBe(true);
      }
    );
    it.each(['individual', 'organization'])(
      'accepts creation type %s',
      (type) => {
        expect(
          counterpartyCreateReqValidation.safeParse({ ...validPayload, type })
            .success
        ).toBe(true);
      }
    );
    it.each([{ type: 'invalid' }, { status: 'invalid' }])(
      'rejects invalid creation enums %j',
      (fields) => {
        expect(
          counterpartyCreateReqValidation.safeParse({
            ...validPayload,
            ...fields,
          }).success
        ).toBe(false);
      }
    );
    it('accepts a valid payload', () => {
      const result = counterpartyCreateReqValidation.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (!result.success) {
        throw result.error;
      }
      expect(result.data).toEqual(validPayload);
    });

    it('trims name whitespace', () => {
      const result = counterpartyCreateReqValidation.safeParse({
        ...validPayload,
        name: '  Acme Corp  ',
      });
      expect(result.success).toBe(true);
      if (!result.success) {
        throw result.error;
      }
      expect(result.data.name).toBe('Acme Corp');
    });

    it('rejects empty or whitespace-only name', () => {
      const result = counterpartyCreateReqValidation.safeParse({
        ...validPayload,
        name: '   ',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(invalidNameKey);
      }
    });

    it('rejects name exceeding 255 characters', () => {
      const result = counterpartyCreateReqValidation.safeParse({
        ...validPayload,
        name: 'a'.repeat(256),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(invalidNameKey);
      }
    });
  });

  describe('getCounterpartiesQueryValidationSchema', () => {
    it('accepts an empty query object', () => {
      const result = getCounterpartiesQueryValidationSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({});
      }
    });

    it('accepts and validates valid filters', () => {
      const validQuery = {
        roles: ['vendor', 'contractor'],
        type: 'organization',
        status: 'active',
        orderBy: 'name',
        sortDirection: 'asc',
        limit: 10,
        page: 2,
        search: 'Acme',
      };
      const result =
        getCounterpartiesQueryValidationSchema.safeParse(validQuery);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validQuery);
      }
    });

    it('coerces single role string to an array', () => {
      const query = { roles: 'vendor' };
      const result = getCounterpartiesQueryValidationSchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.roles).toEqual(['vendor']);
      }
    });

    it('coerces null role to undefined', () => {
      const query = { roles: null };
      const result = getCounterpartiesQueryValidationSchema.safeParse(query);
      if (!result.success)
        console.error(JSON.stringify(result.error.issues, null, 2));
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.roles).toBeUndefined();
      }
    });

    it('coerces empty string role to undefined', () => {
      const query = { roles: '' };
      const result = getCounterpartiesQueryValidationSchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.roles).toBeUndefined();
      }
    });

    it('rejects invalid role inside the roles array', () => {
      const invalidRoleKey = new counterpartyError.InvalidRole().errorKey;
      const query = { roles: ['vendor', 'invalid_role'] };
      const result = getCounterpartiesQueryValidationSchema.safeParse(query);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(invalidRoleKey);
      }
    });

    it('rejects invalid type', () => {
      const query = { type: 'invalid_type' };
      const result = getCounterpartiesQueryValidationSchema.safeParse(query);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(invalidTypeKey);
      }
    });

    it('rejects invalid status', () => {
      const query = { status: 'invalid_status' };
      const result = getCounterpartiesQueryValidationSchema.safeParse(query);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(invalidStatusKey);
      }
    });

    it('rejects invalid orderBy', () => {
      const invalidOrderByKey = new paginationError.InvalidOrderBy().errorKey;
      const query = { orderBy: 'invalid_order_by' };
      const result = getCounterpartiesQueryValidationSchema.safeParse(query);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(invalidOrderByKey);
      }
    });

    it('rejects invalid pagination limit', () => {
      const invalidLimitKey = new paginationError.InvalidLimit().errorKey;
      const query = { limit: -1 };
      const result = getCounterpartiesQueryValidationSchema.safeParse(query);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(invalidLimitKey);
      }
    });
  });
});

describe('creation metadata request validation', () => {
  const base = { name: 'Acme', status: 'active', type: 'organization' };
  const address = { line1: 'Street', city: 'Lagos', countryCode: 'ng' };

  it.each([
    {},
    { vendor: {} },
    { vendor: { address: null } },
    { vendor: { address } },
    { employer: { address } },
    { employer: { address, displayName: null } },
    { employer: { address, displayName: ' ' } },
    { contractor: { address } },
    { employer: { address }, vendor: {}, contractor: { address } },
  ])('accepts metadata %j', (meta) => {
    expect(
      counterpartyCreateReqValidation.safeParse({ ...base, meta }).success
    ).toBe(true);
  });

  it.each([
    { meta: null },
    { meta: [] },
    { meta: 'vendor' },
    { meta: { customer: {} } },
    { meta: { vendor: undefined } },
    { meta: { vendor: null } },
    { meta: { employer: {} } },
    { meta: { contractor: {} } },
    { meta: { contractor: { address: null } } },
    { meta: { vendor: { extra: true } } },
    { meta: { contractor: { address, displayName: 'No' } } },
    { meta: { employer: { address, displayName: 5 } } },
    { meta: { employer: { address, displayName: 'x'.repeat(256) } } },
    { meta: { vendor: { address: { ...address, extra: true } } } },
    { meta: { vendor: { address: { ...address, line2: null } } } },
    { roles: ['vendor'] },
    { address },
    { displayName: 'Old input' },
    { accountingEntityId: 'not-client-owned' },
    { id: 'not-client-owned' },
    { createdAt: '2026-01-01' },
  ])('rejects invalid or unsupported creation fields %j', (fields) => {
    expect(
      counterpartyCreateReqValidation.safeParse({ ...base, ...fields }).success
    ).toBe(false);
  });

  it('identifies nested address errors at their request path', () => {
    const parsed = counterpartyCreateReqValidation.safeParse({
      ...base,
      meta: { contractor: { address: { ...address, city: '' } } },
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error('Expected invalid city');
    expect(parsed.error.issues[0].path).toEqual([
      'meta',
      'contractor',
      'address',
      'city',
    ]);
  });
});
