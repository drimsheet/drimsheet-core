import { runInNewContext } from 'node:vm';

import addressValue from '@shared/values/contact-details/address.vo';

import counterpartyError from '@domain/counterparty/errors/counterparty.error';
import { ICounterpartyRoleDetails } from '@domain/counterparty/types/counterparty.types';
import counterpartyRoleDetailsValidation from '@domain/counterparty/values/validations/counterparty-role-details.validation';

const address = addressValue.make({
  line1: 'Main Street',
  city: 'Lagos',
  countryCode: 'NG',
});

describe('counterpartyRoleDetailsValidation', () => {
  it('accepts plain JSON parsed in another JavaScript context', () => {
    const roleDetails = runInNewContext(
      'JSON.parse(\'{"vendor":{"address":null}}\')'
    ) as ICounterpartyRoleDetails;
    expect(() =>
      counterpartyRoleDetailsValidation.validate(roleDetails)
    ).not.toThrow();
    expect(() =>
      counterpartyRoleDetailsValidation.validateCreate(roleDetails)
    ).not.toThrow();
  });

  it('rejects class instances with otherwise valid role details', () => {
    class Vendor {
      address = null;
    }
    expect(() =>
      counterpartyRoleDetailsValidation.validate({ vendor: new Vendor() })
    ).toThrow(counterpartyError.InvalidRoleDetails);
  });

  it.each([
    {},
    { vendor: { address: null } },
    { employer: { displayName: null, address } },
    { contractor: { address } },
    {
      employer: { displayName: 'Employer', address },
      vendor: { address },
      contractor: { address },
    },
  ])('accepts valid role details %j', (roleDetails) => {
    expect(() =>
      counterpartyRoleDetailsValidation.validate(roleDetails)
    ).not.toThrow();
  });

  it.each([
    undefined,
    null,
    [],
    new Date(),
    'vendor',
    { customer: {} },
    { vendor: null },
    { vendor: undefined },
    { vendor: [] },
    { vendor: new Date() },
  ])('rejects malformed role details %j', (roleDetails) => {
    expect(() =>
      counterpartyRoleDetailsValidation.validate(
        roleDetails as ICounterpartyRoleDetails
      )
    ).toThrow(counterpartyError.InvalidRoleDetails);
  });

  it.each([null, undefined, [], 'address', 1])(
    'rejects invalid required addresses %j',
    (invalid) => {
      expect(() =>
        counterpartyRoleDetailsValidation.validate({
          employer: { displayName: null, address: invalid },
        } as unknown as ICounterpartyRoleDetails)
      ).toThrow(counterpartyError.InvalidAddress);
    }
  );

  it('does not accept omitted vendor address as canonical role details', () => {
    expect(() =>
      counterpartyRoleDetailsValidation.validate({
        vendor: {},
      } as ICounterpartyRoleDetails)
    ).toThrow(counterpartyError.InvalidAddress);
  });

  it.each(['line1', 'city', 'countryCode'] as const)(
    'checks required address field %s',
    (field) => {
      expect(() =>
        counterpartyRoleDetailsValidation.validate({
          contractor: { address: { ...address, [field]: '' } },
        })
      ).toThrow();
    }
  );

  it.each([
    { field: 'line2', max: 255 },
    { field: 'region', max: 100 },
    { field: 'postalCode', max: 20 },
  ])('checks nullable address field $field', ({ field, max }) => {
    expect(() =>
      counterpartyRoleDetailsValidation.validate({
        vendor: { address: { ...address, [field]: 'x'.repeat(max) } },
      })
    ).not.toThrow();
    for (const invalid of [undefined, 42, 'x'.repeat(max + 1)]) {
      expect(() =>
        counterpartyRoleDetailsValidation.validate({
          vendor: { address: { ...address, [field]: invalid } },
        })
      ).toThrow(counterpartyError.InvalidAddress);
    }
  });

  it.each([undefined, 42, 'x'.repeat(256)])(
    'rejects invalid display name %j',
    (displayName) => {
      expect(() =>
        counterpartyRoleDetailsValidation.validate({
          employer: { address, displayName },
        } as ICounterpartyRoleDetails)
      ).toThrow(counterpartyError.InvalidName);
    }
  );

  it('accepts a JSON-like object without a prototype', () => {
    expect(() =>
      counterpartyRoleDetailsValidation.validate(
        Object.create(null) as ICounterpartyRoleDetails
      )
    ).not.toThrow();
  });
});

describe('creation role details validation', () => {
  type Input = Parameters<
    typeof counterpartyRoleDetailsValidation.validateCreate
  >[0];
  const rawAddress = { line1: 'Street', city: 'Lagos', countryCode: 'ng' };

  it.each([
    {},
    { vendor: {} },
    { vendor: { address: undefined } },
    { vendor: { address: null } },
    { employer: { address: rawAddress } },
    { employer: { address: rawAddress, displayName: null } },
    { employer: { address: rawAddress, displayName: 'Company' } },
    {
      contractor: {
        address: {
          ...rawAddress,
          line2: null,
          region: 'State',
          postalCode: undefined,
        },
      },
    },
  ])('accepts raw optional fields %j', (roleDetails) => {
    expect(() =>
      counterpartyRoleDetailsValidation.validateCreate(roleDetails)
    ).not.toThrow();
  });

  it.each([
    undefined,
    null,
    [],
    'roleDetails',
    new Date(),
    { invalid: {} },
    { vendor: null },
    { vendor: undefined },
    { vendor: [] },
    { vendor: { unknown: true } },
    { contractor: { displayName: 'bad', address: rawAddress } },
    { employer: { displayName: 42, address: rawAddress } },
    { employer: { displayName: {}, address: rawAddress } },
    { employer: {} },
    { contractor: { address: null } },
    { vendor: { address: [] } },
    { vendor: { address: new Date() } },
    { vendor: { address: { ...rawAddress, bad: 1 } } },
    { vendor: { address: { ...rawAddress, line2: 1 } } },
    { vendor: { address: { ...rawAddress, region: false } } },
    { vendor: { address: { ...rawAddress, postalCode: [] } } },
  ])('rejects invalid raw role details %j', (roleDetails) => {
    expect(() =>
      counterpartyRoleDetailsValidation.validateCreate(
        roleDetails as unknown as Input
      )
    ).toThrow();
  });
});
