import counterpartyError from '@domain/counterparty/errors/counterparty.error';
import getUpdatedCounterpartyRoleDetailsHelper from '@domain/counterparty/services/helpers/get-updated-counterparty-role-details.helper';

describe('getUpdatedCounterpartyRoleDetailsHelper', () => {
  const address = { line1: ' Road ', city: ' Lagos ', countryCode: 'ng' };

  it('preserves omitted role details', () => {
    expect(getUpdatedCounterpartyRoleDetailsHelper(undefined)).toBeUndefined();
  });

  it('returns empty replacement role details when all roles are removed', () => {
    expect(getUpdatedCounterpartyRoleDetailsHelper({})).toEqual({});
  });

  it('normalizes every supplied role without mutating the request', () => {
    const requestedRoleDetails = {
      employer: { address },
      vendor: {},
      contractor: { address },
    };
    const snapshot = structuredClone(requestedRoleDetails);

    const roleDetails =
      getUpdatedCounterpartyRoleDetailsHelper(requestedRoleDetails);

    expect(roleDetails).toMatchObject({
      employer: {
        displayName: null,
        address: { line1: 'Road', city: 'Lagos', countryCode: 'NG' },
      },
      vendor: { address: null },
      contractor: {
        address: { line1: 'Road', city: 'Lagos', countryCode: 'NG' },
      },
    });
    expect(requestedRoleDetails).toEqual(snapshot);
    expect(Object.isFrozen(roleDetails?.employer?.address)).toBe(true);
    expect(Object.isFrozen(roleDetails?.vendor)).toBe(true);
    expect(Object.isFrozen(roleDetails?.contractor?.address)).toBe(true);
  });

  it('includes only the supplied roles in replacement role details', () => {
    expect(getUpdatedCounterpartyRoleDetailsHelper({ vendor: {} })).toEqual({
      vendor: { address: null },
    });
  });

  it.each([null, { employer: {} }, { unknown: {} }])(
    'rejects invalid raw role details %j',
    (roleDetails) => {
      expect(() =>
        getUpdatedCounterpartyRoleDetailsHelper(roleDetails as never)
      ).toThrow(counterpartyError.Base);
    }
  );

  it.each(['employer', 'vendor', 'contractor'] as const)(
    'reports address errors with the %s field path',
    (role) => {
      try {
        getUpdatedCounterpartyRoleDetailsHelper({
          [role]: { address: { ...address, city: '' } },
        });
        throw new Error('Expected invalid address');
      } catch (error) {
        expect(error).toMatchObject({
          errorKey: 'counterparty_error_address_invalid',
          cause: { field: `roleDetails.${role}.address` },
        });
      }
    }
  );

  it('preserves non-address errors from role construction', () => {
    expect(() =>
      getUpdatedCounterpartyRoleDetailsHelper({
        employer: { address, displayName: 'x'.repeat(256) },
      })
    ).toThrow(counterpartyError.InvalidName);
  });
});
