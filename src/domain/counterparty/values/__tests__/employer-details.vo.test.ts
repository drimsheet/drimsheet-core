import addressValue from '@shared/values/contact-details/address.vo';

import employerDetailsValue from '@domain/counterparty/values/employer-details.vo';

const address = addressValue.make({
  line1: 'Main Street',
  city: 'Lagos',
  countryCode: 'NG',
});

describe('employer role details', () => {
  it('constructs deeply immutable address details without keeping a mutable alias', () => {
    const value = employerDetailsValue.make({
      address,
      displayName: ' Employer ',
    });
    expect(value.address).toEqual(address);
    expect(value.address).not.toBe(address);
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.address)).toBe(true);
    expect(value.displayName).toBe('Employer');
  });
  it.each([null, '', '   '])(
    'normalizes an absent display name %j',
    (displayName) => {
      expect(
        employerDetailsValue.make({ address, displayName }).displayName
      ).toBeNull();
    }
  );
});

it('validates display-name length after trimming, preserving existing normalization', () => {
  expect(
    employerDetailsValue.make({
      address,
      displayName: ' '.repeat(256) + 'Employer',
    }).displayName
  ).toBe('Employer');
});

it('constructs a canonical address and display name from raw optional inputs', () => {
  expect(
    employerDetailsValue.make({
      address: { line1: ' Street ', city: ' Lagos ', countryCode: 'ng' },
    })
  ).toEqual({
    displayName: null,
    address: {
      line1: 'Street',
      line2: null,
      city: 'Lagos',
      region: null,
      postalCode: null,
      countryCode: 'NG',
    },
  });
});
