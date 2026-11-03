import counterpartyDtoMapper from '@app/counterparty/dtos/counterparty/counterparty.dto.mapper';
import { counterpartyUpdateReqValidation } from '@app/counterparty/dtos/counterparty/counterparty.dto.validation';

const address = { line1: 'Road', city: 'Lagos', countryCode: 'NG' };

describe('counterparty update DTO', () => {
  it.each([
    { name: 'Changed' },
    { type: 'organization' },
    { status: 'active' },
    { roleDetails: {} },
    { roleDetails: { vendor: {} } },
    {
      roleDetails: {
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
    { roleDetails: null },
    { roleDetails: { vendor: null } },
    { roleDetails: { employer: {} } },
    { roleDetails: { contractor: { address: null } } },
    { roleDetails: { vendor: { unexpected: true } } },
  ])('rejects %j', (payload) => {
    expect(counterpartyUpdateReqValidation.safeParse(payload).success).toBe(
      false
    );
  });
  it('reports the nested field needing correction', () => {
    const result = counterpartyUpdateReqValidation.safeParse({
      status: 'active',
      roleDetails: { contractor: { address: { ...address, city: '' } } },
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual([
      'roleDetails',
      'contractor',
      'address',
      'city',
    ]);
  });
  it('distinguishes omitted role details from a complete empty replacement', () => {
    expect(counterpartyDtoMapper.fromUpdateDto({ name: 'Changed' })).toEqual({
      name: 'Changed',
      type: undefined,
      status: undefined,
      roleDetails: undefined,
    });
    expect(
      counterpartyDtoMapper.fromUpdateDto({ roleDetails: {} }).roleDetails
    ).toEqual({});
  });
  it('maps complete role details without synthesizing omitted roles', () => {
    const payload = {
      roleDetails: {
        employer: { address, displayName: 'Name' },
        contractor: { address },
        vendor: { address: null },
      },
      status: 'active' as const,
    };
    const mapped = counterpartyDtoMapper.fromUpdateDto(payload);
    expect(mapped).toMatchObject({
      roleDetails: payload.roleDetails,
      status: payload.status,
    });
    expect(mapped.roleDetails).not.toBe(payload.roleDetails);
    expect(mapped.roleDetails?.contractor?.address).not.toBe(address);
    expect(
      counterpartyDtoMapper.fromUpdateDto({
        roleDetails: { vendor: {} },
      }).roleDetails
    ).toEqual({ vendor: { address: undefined } });
  });
});
