import counterpartyError from '@domain/counterparty/errors/counterparty.error';
import getUpdatedCounterpartyMetaHelper from '@domain/counterparty/services/helpers/get-updated-counterparty-meta.helper';

describe('getUpdatedCounterpartyMetaHelper', () => {
  const address = { line1: ' Road ', city: ' Lagos ', countryCode: 'ng' };

  it('preserves omitted metadata', () => {
    expect(getUpdatedCounterpartyMetaHelper(undefined)).toBeUndefined();
  });

  it('returns empty replacement metadata when all roles are removed', () => {
    expect(getUpdatedCounterpartyMetaHelper({})).toEqual({});
  });

  it('normalizes every supplied role without mutating the request', () => {
    const requestedMeta = {
      employer: { address },
      vendor: {},
      contractor: { address },
    };
    const snapshot = structuredClone(requestedMeta);

    const meta = getUpdatedCounterpartyMetaHelper(requestedMeta);

    expect(meta).toMatchObject({
      employer: {
        displayName: null,
        address: { line1: 'Road', city: 'Lagos', countryCode: 'NG' },
      },
      vendor: { address: null },
      contractor: {
        address: { line1: 'Road', city: 'Lagos', countryCode: 'NG' },
      },
    });
    expect(requestedMeta).toEqual(snapshot);
    expect(Object.isFrozen(meta?.employer?.address)).toBe(true);
    expect(Object.isFrozen(meta?.vendor)).toBe(true);
    expect(Object.isFrozen(meta?.contractor?.address)).toBe(true);
  });

  it('includes only the supplied roles in replacement metadata', () => {
    expect(getUpdatedCounterpartyMetaHelper({ vendor: {} })).toEqual({
      vendor: { address: null },
    });
  });

  it.each([null, { employer: {} }, { unknown: {} }])(
    'rejects invalid raw metadata %j',
    (meta) => {
      expect(() => getUpdatedCounterpartyMetaHelper(meta as never)).toThrow(
        counterpartyError.Base
      );
    }
  );

  it.each(['employer', 'vendor', 'contractor'] as const)(
    'reports address errors with the %s field path',
    (role) => {
      try {
        getUpdatedCounterpartyMetaHelper({
          [role]: { address: { ...address, city: '' } },
        });
        throw new Error('Expected invalid address');
      } catch (error) {
        expect(error).toMatchObject({
          errorKey: 'counterparty_error_address_invalid',
          cause: { field: `meta.${role}.address` },
        });
      }
    }
  );

  it('preserves non-address errors from role construction', () => {
    expect(() =>
      getUpdatedCounterpartyMetaHelper({
        employer: { address, displayName: 'x'.repeat(256) },
      })
    ).toThrow(counterpartyError.InvalidName);
  });
});
