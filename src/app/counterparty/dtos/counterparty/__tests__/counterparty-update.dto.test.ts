import counterpartyDtoMapper from '@app/counterparty/dtos/counterparty/counterparty.dto.mapper';
import { counterpartyUpdateReqValidation } from '@app/counterparty/dtos/counterparty/counterparty.dto.validation';

const address = { line1: 'Road', city: 'Lagos', countryCode: 'NG' };

describe('counterparty update DTO', () => {
  it.each([
    { name: 'Changed' },
    { type: 'organization' },
    { status: 'active' },
    { meta: {} },
    { meta: { vendor: {} } },
    {
      meta: {
        employer: { address },
        contractor: { address },
        vendor: { address },
      },
    },
  ])('accepts partial update %j', (payload) => {
    expect(counterpartyUpdateReqValidation.safeParse(payload).success).toBe(
      true
    );
  });
  it.each([
    {},
    { name: undefined },
    { status: 'draft' },
    { status: 'archived' },
    { status: null },
    { roles: [] },
    { createdBy: 'forged' },
    { accountingEntityId: 'forged' },
    { expectedVersion: 1, name: 'Changed' },
    { updatedAt: new Date() },
    { meta: null },
    { meta: { vendor: null } },
    { meta: { employer: {} } },
    { meta: { contractor: { address: null } } },
    { meta: { vendor: { unexpected: true } } },
  ])('rejects %j', (payload) => {
    expect(counterpartyUpdateReqValidation.safeParse(payload).success).toBe(
      false
    );
  });
  it('reports the nested field needing correction', () => {
    const result = counterpartyUpdateReqValidation.safeParse({
      status: 'active',
      meta: { contractor: { address: { ...address, city: '' } } },
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual([
      'meta',
      'contractor',
      'address',
      'city',
    ]);
  });
  it('distinguishes omitted metadata from a complete empty replacement', () => {
    expect(counterpartyDtoMapper.fromUpdateDto({ name: 'Changed' })).toEqual({
      name: 'Changed',
      type: undefined,
      status: undefined,
      meta: undefined,
    });
    expect(counterpartyDtoMapper.fromUpdateDto({ meta: {} }).meta).toEqual({});
  });
  it('maps complete role details without synthesizing omitted roles', () => {
    const payload = {
      meta: {
        employer: { address, displayName: 'Name' },
        contractor: { address },
        vendor: { address: null },
      },
      status: 'active' as const,
    };
    const mapped = counterpartyDtoMapper.fromUpdateDto(payload);
    expect(mapped).toMatchObject({
      meta: payload.meta,
      status: payload.status,
    });
    expect(mapped.meta).not.toBe(payload.meta);
    expect(mapped.meta?.contractor?.address).not.toBe(address);
    expect(
      counterpartyDtoMapper.fromUpdateDto({
        meta: { vendor: {} },
      }).meta
    ).toEqual({ vendor: { address: undefined } });
  });
});
