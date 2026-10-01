import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import counterpartyEntity from '@domain/counterparty/entities/counterparty.entity';
import counterpartyValidation from '@domain/counterparty/entities/validations/counterparty.validation';
import counterpartyError from '@domain/counterparty/errors/counterparty.error';
import {
  ECounterpartyRole,
  ECounterpartyStatus,
  ECounterpartyType,
  ICounterparty,
} from '@domain/counterparty/types/counterparty.types';

describe('counterpartyValidation', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(counterpartyValidation)).toBe(true);
    expect(counterpartyEntity.validateCounterparty).toBe(
      counterpartyValidation.validateCounterparty
    );
  });

  const validUUID = generateUUID();
  const validUUID2 = generateUUID();

  describe('validateAccountingEntityId', () => {
    it('should pass for a valid UUID', () => {
      expect(() =>
        counterpartyValidation.validateAccountingEntityId(validUUID)
      ).not.toThrow();
    });

    it('should throw InvalidAccountingEntityId error for invalid UUID', () => {
      expect(() =>
        counterpartyValidation.validateAccountingEntityId(
          'invalid-uuid' as TEntityId
        )
      ).toThrow(counterpartyError.InvalidAccountingEntityId);
    });
  });

  describe('validateName', () => {
    it('should sanitize and return valid name', () => {
      expect(counterpartyValidation.validateName('  Acme Corp  ')).toBe(
        'Acme Corp'
      );
    });

    it('should throw InvalidName error for empty name', () => {
      expect(() => counterpartyValidation.validateName('')).toThrow(
        counterpartyError.InvalidName
      );
    });
  });

  describe('validateType', () => {
    it('should pass for valid types', () => {
      expect(
        counterpartyValidation.validateType(ECounterpartyType.Individual)
      ).toBe(ECounterpartyType.Individual);
      expect(
        counterpartyValidation.validateType(ECounterpartyType.Organization)
      ).toBe(ECounterpartyType.Organization);
    });

    it('should throw InvalidType error for invalid type', () => {
      expect(() =>
        counterpartyValidation.validateType('invalid' as never)
      ).toThrow(counterpartyError.InvalidType);
    });
  });

  describe('validateDraftCreationType', () => {
    it('rejects an omitted type for draft creation', () => {
      expect(() =>
        counterpartyValidation.validateDraftCreationType(
          ECounterpartyStatus.Draft,
          undefined
        )
      ).toThrow(counterpartyError.InvalidType);
    });

    it.each([ECounterpartyType.Individual, ECounterpartyType.Organization])(
      'accepts explicit draft type %s',
      (type) => {
        expect(() =>
          counterpartyValidation.validateDraftCreationType(
            ECounterpartyStatus.Draft,
            type
          )
        ).not.toThrow();
      }
    );

    it.each([ECounterpartyStatus.Active, ECounterpartyStatus.Archived])(
      'does not apply the draft requirement to %s creation',
      (status) => {
        expect(() =>
          counterpartyValidation.validateDraftCreationType(status, undefined)
        ).not.toThrow();
      }
    );
  });

  describe('validateStatus', () => {
    it('should pass for valid status', () => {
      expect(
        counterpartyValidation.validateStatus(ECounterpartyStatus.Active)
      ).toBe(ECounterpartyStatus.Active);
      expect(
        counterpartyValidation.validateStatus(ECounterpartyStatus.Archived)
      ).toBe(ECounterpartyStatus.Archived);
    });

    it('should throw InvalidStatus error for invalid status', () => {
      expect(() =>
        counterpartyValidation.validateStatus('invalid' as never)
      ).toThrow(counterpartyError.InvalidStatus);
    });
  });

  describe('validateRole', () => {
    it('should pass for valid role', () => {
      expect(
        counterpartyValidation.validateRole(ECounterpartyRole.Vendor)
      ).toBe(ECounterpartyRole.Vendor);
    });

    it('should throw InvalidRole error for invalid role', () => {
      expect(() =>
        counterpartyValidation.validateRole('invalid' as never)
      ).toThrow(counterpartyError.InvalidRole);
    });
  });

  describe('validateCounterparty', () => {
    it('rejects an invalid creator on the source entity', () => {
      const [counterparty] = counterpartyEntity.make({
        createdBy: validUUID,
        accountingEntityId: validUUID2,
        name: 'Supplier',
        type: 'organization',
      });

      expect(() =>
        counterpartyValidation.validateCounterparty({
          ...counterparty,
          createdBy: 'invalid' as TEntityId,
        })
      ).toThrow(counterpartyError.InvalidCreatedBy);
    });

    it('should pass for a valid counterparty entity', () => {
      const validCounterparty: ICounterparty = {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id: validUUID,
        accountingEntityId: validUUID2,
        name: 'Jane Doe',
        status: ECounterpartyStatus.Active,
        type: ECounterpartyType.Individual,
        meta: {
          contractor: {
            address: {
              line1: 'Main Street',
              line2: null,
              city: 'Lagos',
              region: null,
              postalCode: null,
              countryCode: 'NG',
            },
          },
        },
        roles: [ECounterpartyRole.Contractor],
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(() =>
        counterpartyValidation.validateCounterparty(validCounterparty)
      ).not.toThrow();
    });

    it('should throw InvalidCounterpartyEntity for null or non-object', () => {
      expect(() =>
        counterpartyValidation.validateCounterparty(
          null as unknown as ICounterparty
        )
      ).toThrow(counterpartyError.InvalidCounterpartyEntity);
    });

    it('should throw InvalidRole if roles is not an array', () => {
      const invalidCounterparty = {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id: validUUID,
        accountingEntityId: validUUID2,
        name: 'Jane Doe',
        status: ECounterpartyStatus.Active,
        type: ECounterpartyType.Individual,
        meta: {},
        roles: 'not-an-array',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(() =>
        counterpartyValidation.validateCounterparty(
          invalidCounterparty as unknown as ICounterparty
        )
      ).toThrow(counterpartyError.InvalidRole);
    });
  });
});

describe('update status validation', () => {
  it.each(['draft', 'active'] as const)(
    'allows details-only edits to %s',
    (status) => {
      expect(() =>
        counterpartyValidation.validateUpdateStatus(status, undefined)
      ).not.toThrow();
    }
  );
  it('allows Draft activation', () => {
    expect(() =>
      counterpartyValidation.validateUpdateStatus('draft', 'active')
    ).not.toThrow();
  });
  it('rejects repeated activation', () => {
    expect(() =>
      counterpartyValidation.validateUpdateStatus('active', 'active')
    ).toThrow(counterpartyError.AlreadyActive);
  });
  it('rejects an Archived source', () => {
    expect(() =>
      counterpartyValidation.validateUpdateStatus('archived', undefined)
    ).toThrow(counterpartyError.Archived);
  });
  it.each(['draft', 'archived'] as const)('rejects target %s', (status) => {
    expect(() =>
      counterpartyValidation.validateUpdateStatus('draft', status)
    ).toThrow(counterpartyError.InvalidStatus);
  });
});
