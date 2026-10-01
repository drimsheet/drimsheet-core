import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';
import addressValue from '@shared/values/contact-details/address.vo';

import counterpartyEntity from '@domain/counterparty/entities/counterparty.entity';
import makeCounterpartyService from '@domain/counterparty/services/counterparty.service';

import { mockJournalLineRepo } from '@app/journal-entry/contracts/__mocks__/journal-entry.repos.mock';

import counterpartyMapper from '@infra/persistence/repos/counterparty/mappers/counterparty.mapper';

const service = makeCounterpartyService({
  journalLineRepo: mockJournalLineRepo,
});

const payload = {
  createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
  accountingEntityId: generateUUID(),
  name: 'Example',
  type: 'organization' as const,
};

describe('counterpartyMapper', () => {
  it.each([0, 1, 2, 3, 4, 5, 6, 7])(
    'round-trips role combination %i',
    (combination) => {
      const address = {
        line1: 'Main Street',
        city: 'Lagos',
        countryCode: 'NG',
      };
      const meta: NonNullable<Parameters<typeof service.create>[0]['meta']> =
        {};
      if (combination & 1) meta.employer = { address };
      if (combination & 2) meta.vendor = { address: null };
      if (combination & 4) meta.contractor = { address };

      const [entity] = service.create({
        ...payload,
        meta,
      });
      const row = counterpartyMapper.toRepo(entity);

      expect(row.meta).toEqual(entity.meta);
      expect(counterpartyMapper.toDomain(row)).toEqual(entity);
    }
  );

  it('round-trips a generic counterparty with empty metadata', () => {
    const [entity] = service.create(payload);
    const row = counterpartyMapper.toRepo(entity);
    expect(row.meta).toEqual({});
    expect(counterpartyMapper.toDomain(row)).toEqual(entity);
  });

  it('derives stable roles from metadata and isolates nested values', () => {
    const address = addressValue.make({
      line1: 'Main Street',
      city: 'Lagos',
      countryCode: 'NG',
    });
    const [vendor] = service.create({
      ...payload,
      meta: { vendor: { address: null } },
    });
    const [entity] = counterpartyEntity.addRole(vendor, {
      role: 'employer',
      meta: { displayName: null, address },
    });
    const row = counterpartyMapper.toRepo(entity);
    const hydrated = counterpartyMapper.toDomain(row);
    expect(hydrated).toEqual(entity);
    expect(hydrated.roles).toEqual(['employer', 'vendor']);
    expect(hydrated.meta).not.toBe(row.meta);
    expect(row.meta).not.toBe(entity.meta);
    expect(row.meta).toEqual(entity.meta);
    expect(Object.isFrozen(hydrated.meta.employer?.address)).toBe(true);
    expect(Object.isFrozen(hydrated.roles)).toBe(true);
  });

  it('round-trips distinct addresses for every role in metadata', () => {
    const employerAddress = addressValue.make({
      line1: 'Employer Street',
      city: 'Lagos',
      countryCode: 'NG',
    });
    const vendorAddress = addressValue.make({
      line1: 'Vendor Street',
      line2: 'Suite 2',
      city: 'Abuja',
      region: 'FCT',
      postalCode: '900001',
      countryCode: 'NG',
    });
    const contractorAddress = addressValue.make({
      line1: 'Contractor Street',
      city: 'Ibadan',
      countryCode: 'NG',
    });
    const [employer] = service.create({
      ...payload,
      meta: {
        employer: {
          displayName: 'Acme',
          address: employerAddress,
        },
      },
    });
    const [vendor] = counterpartyEntity.addRole(employer, {
      role: 'vendor',
      meta: { address: vendorAddress },
    });
    const [entity] = counterpartyEntity.addRole(vendor, {
      role: 'contractor',
      meta: { address: contractorAddress },
    });
    const row = counterpartyMapper.toRepo(entity);
    const hydrated = counterpartyMapper.toDomain(row);
    expect(row.meta).toEqual(entity.meta);
    expect(hydrated).toEqual(entity);
    expect(hydrated.meta.vendor?.address).not.toBe(vendorAddress);
    expect(Object.isFrozen(hydrated.meta.contractor?.address)).toBe(true);
  });

  it('isolates stored addresses from the entity and hydrated addresses from the row', () => {
    const [entity] = service.create({
      ...payload,
      meta: {
        contractor: {
          address: { line1: 'Main Street', city: 'Lagos', countryCode: 'NG' },
        },
      },
    });
    const row = counterpartyMapper.toRepo(entity);
    const storedMeta = row.meta as typeof entity.meta;
    const hydrated = counterpartyMapper.toDomain(row);

    expect(storedMeta.contractor?.address).not.toBe(
      entity.meta.contractor?.address
    );
    expect(hydrated.meta.contractor?.address).not.toBe(
      storedMeta.contractor?.address
    );
    storedMeta.contractor!.address.city = 'Abuja';
    expect(entity.meta.contractor?.address.city).toBe('Lagos');
    expect(hydrated.meta.contractor?.address.city).toBe('Lagos');
    expect(row.createdAt).toBe(entity.createdAt.toISOString());
    expect(row.updatedAt).toBe(entity.updatedAt.toISOString());
    expect(hydrated.createdAt).toEqual(entity.createdAt);
    expect(hydrated.updatedAt).toEqual(entity.updatedAt);
  });
});
