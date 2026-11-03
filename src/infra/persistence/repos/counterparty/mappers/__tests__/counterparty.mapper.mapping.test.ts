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
      const roleDetails: NonNullable<
        Parameters<typeof service.create>[0]['roleDetails']
      > = {};
      if (combination & 1) {
        roleDetails.employer = { address };
      }
      if (combination & 2) {
        roleDetails.vendor = { address: null };
      }
      if (combination & 4) {
        roleDetails.contractor = { address };
      }

      const [entity] = service.create({
        ...payload,
        roleDetails,
      });
      const row = counterpartyMapper.toRepo(entity);

      expect(row.roleDetails).toEqual(entity.roleDetails);
      expect(counterpartyMapper.toDomain(row)).toEqual(entity);
    }
  );

  it('round-trips a generic counterparty with empty role details', () => {
    const [entity] = service.create(payload);
    const row = counterpartyMapper.toRepo(entity);
    expect(row.roleDetails).toEqual({});
    expect(counterpartyMapper.toDomain(row)).toEqual(entity);
  });

  it('derives stable roles from role details and isolates nested values', () => {
    const address = addressValue.make({
      line1: 'Main Street',
      city: 'Lagos',
      countryCode: 'NG',
    });
    const [vendor] = service.create({
      ...payload,
      roleDetails: { vendor: { address: null } },
    });
    const [entity] = counterpartyEntity.addRole(vendor, {
      role: 'employer',
      roleDetails: { displayName: null, address },
    });
    const row = counterpartyMapper.toRepo(entity);
    const hydrated = counterpartyMapper.toDomain(row);
    expect(hydrated).toEqual(entity);
    expect(hydrated.roles).toEqual(['employer', 'vendor']);
    expect(hydrated.roleDetails).not.toBe(row.roleDetails);
    expect(row.roleDetails).not.toBe(entity.roleDetails);
    expect(row.roleDetails).toEqual(entity.roleDetails);
    expect(Object.isFrozen(hydrated.roleDetails.employer?.address)).toBe(true);
    expect(Object.isFrozen(hydrated.roles)).toBe(true);
  });

  it('round-trips distinct addresses for every role in role details', () => {
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
      roleDetails: {
        employer: {
          displayName: 'Acme',
          address: employerAddress,
        },
      },
    });
    const [vendor] = counterpartyEntity.addRole(employer, {
      role: 'vendor',
      roleDetails: { address: vendorAddress },
    });
    const [entity] = counterpartyEntity.addRole(vendor, {
      role: 'contractor',
      roleDetails: { address: contractorAddress },
    });
    const row = counterpartyMapper.toRepo(entity);
    const hydrated = counterpartyMapper.toDomain(row);
    expect(row.roleDetails).toEqual(entity.roleDetails);
    expect(hydrated).toEqual(entity);
    expect(hydrated.roleDetails.vendor?.address).not.toBe(vendorAddress);
    expect(Object.isFrozen(hydrated.roleDetails.contractor?.address)).toBe(
      true
    );
  });

  it('isolates stored addresses from the entity and hydrated addresses from the row', () => {
    const [entity] = service.create({
      ...payload,
      roleDetails: {
        contractor: {
          address: { line1: 'Main Street', city: 'Lagos', countryCode: 'NG' },
        },
      },
    });
    const row = counterpartyMapper.toRepo(entity);
    const storedRoleDetails = row.roleDetails as typeof entity.roleDetails;
    const hydrated = counterpartyMapper.toDomain(row);

    expect(storedRoleDetails.contractor?.address).not.toBe(
      entity.roleDetails.contractor?.address
    );
    expect(hydrated.roleDetails.contractor?.address).not.toBe(
      storedRoleDetails.contractor?.address
    );
    storedRoleDetails.contractor!.address.city = 'Abuja';
    expect(entity.roleDetails.contractor?.address.city).toBe('Lagos');
    expect(hydrated.roleDetails.contractor?.address.city).toBe('Lagos');
    expect(row.createdAt).toBe(entity.createdAt.toISOString());
    expect(row.updatedAt).toBe(entity.updatedAt.toISOString());
    expect(hydrated.createdAt).toEqual(entity.createdAt);
    expect(hydrated.updatedAt).toEqual(entity.updatedAt);
  });
});
