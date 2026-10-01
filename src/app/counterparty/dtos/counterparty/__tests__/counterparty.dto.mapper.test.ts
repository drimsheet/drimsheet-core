import { TEntityId } from '@shared/types/uuid';

import makeCounterpartyService from '@domain/counterparty/services/counterparty.service';
import { ICounterparty } from '@domain/counterparty/types/counterparty.types';

import counterpartyDtoMapper from '@app/counterparty/dtos/counterparty/counterparty.dto.mapper';
import { mockJournalLineRepo } from '@app/journal-entry/contracts/__mocks__/journal-entry.repos.mock';

describe('Counterparty DTO Mapper', () => {
  describe('toDto', () => {
    it('should map counterparty domain entity to DTO correctly', () => {
      const mockCounterparty: ICounterparty = {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id: 'cp-id-123' as unknown as TEntityId,
        accountingEntityId: 'ae-id-456' as unknown as TEntityId,
        name: 'John Doe',
        status: 'active',
        type: 'individual',
        meta: {},
        roles: [],
        version: 1,
        createdAt: new Date('2026-08-01T08:00:00Z'),
        updatedAt: new Date('2026-08-01T08:00:00Z'),
      };

      const dto = counterpartyDtoMapper.toDto(mockCounterparty);

      expect(dto).toEqual({
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id: 'cp-id-123',
        accountingEntityId: 'ae-id-456',
        name: 'John Doe',
        status: 'active',
        type: 'individual',
        meta: {},
        roles: [],
        version: 1,
        createdAt: new Date('2026-08-01T08:00:00Z'),
        updatedAt: new Date('2026-08-01T08:00:00Z'),
      });
    });

    it('should preserve roles list', () => {
      const mockCounterparty: ICounterparty = {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id: 'cp-id-123' as unknown as TEntityId,
        accountingEntityId: 'ae-id-456' as unknown as TEntityId,
        name: 'Vendor Corp',
        status: 'active',
        type: 'organization',
        meta: { vendor: { address: null } },
        roles: ['vendor'],
        version: 1,
        createdAt: new Date('2026-08-01T08:00:00Z'),
        updatedAt: new Date('2026-08-01T08:00:00Z'),
      };

      const dto = counterpartyDtoMapper.toDto(mockCounterparty);
      expect(dto.roles).toEqual(['vendor']);
    });
  });
});

describe('creation input mapping', () => {
  const accountingEntityId =
    '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  const base = {
    name: ' Acme ',
    status: 'active' as const,
    type: 'organization' as const,
  };
  const address = { line1: ' Street ', city: ' Lagos ', countryCode: 'ng' };

  it('maps only creation fields and authorized context without normalization', () => {
    const payload = {
      ...base,
      meta: {
        employer: { address },
        vendor: { address },
        contractor: { address },
      },
    };
    const before = structuredClone(payload);
    const mapped = counterpartyDtoMapper.fromDto(
      payload,
      accountingEntityId,
      'a1111111-1111-4111-8111-111111111111' as TEntityId
    );
    expect(mapped).toEqual({
      ...payload,
      accountingEntityId,
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    });
    expect(mapped.meta?.employer?.displayName).toBeUndefined();
    expect(mapped.meta?.employer?.address.line2).toBeUndefined();
    expect(mapped.meta?.employer?.address).not.toBe(address);
    expect(payload).toEqual(before);
  });

  it('preserves omitted and empty metadata distinctly', () => {
    expect(
      counterpartyDtoMapper.fromDto(
        base,
        accountingEntityId,
        'a1111111-1111-4111-8111-111111111111' as TEntityId
      ).meta
    ).toBeUndefined();
    expect(
      counterpartyDtoMapper.fromDto(
        { ...base, meta: {} },
        accountingEntityId,
        'a1111111-1111-4111-8111-111111111111' as TEntityId
      ).meta
    ).toEqual({});
  });

  it.each([{}, { address: null }, { address }])(
    'preserves vendor optional address %j',
    (vendor) => {
      expect(
        counterpartyDtoMapper.fromDto(
          { ...base, meta: { vendor } },
          accountingEntityId,
          'a1111111-1111-4111-8111-111111111111' as TEntityId
        ).meta
      ).toEqual({ vendor });
    }
  );
});

describe('complete counterparty response mapping', () => {
  it.each([
    { line2: null, region: null, postalCode: null },
    { line2: 'Suite 1', region: 'Lagos', postalCode: '100001' },
  ])('preserves every role address and optional component %j', (optional) => {
    const address = {
      line1: 'Street',
      city: 'Lagos',
      countryCode: 'NG',
      ...optional,
    };
    const [counterparty] = makeCounterpartyService({
      journalLineRepo: mockJournalLineRepo,
    }).create({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      accountingEntityId: '123e4567-e89b-12d3-a456-426614174001' as TEntityId,
      name: 'Company',
      type: 'organization',
      meta: {
        employer: { address, displayName: 'Company' },
        vendor: { address },
        contractor: { address },
      },
    });
    const dto = counterpartyDtoMapper.toDto(counterparty);
    const addressDto = {
      line1: 'Street',
      city: 'Lagos',
      countryCode: 'NG',
      line2: optional.line2 ?? undefined,
      region: optional.region ?? undefined,
      postalCode: optional.postalCode ?? undefined,
    };
    expect(dto.meta).toEqual({
      employer: { displayName: 'Company', address: addressDto },
      vendor: { address: addressDto },
      contractor: { address: addressDto },
    });
    expect(dto.roles).toEqual(['employer', 'vendor', 'contractor']);
    expect(dto.meta.employer?.address).not.toBe(
      counterparty.meta.employer?.address
    );
  });
});
