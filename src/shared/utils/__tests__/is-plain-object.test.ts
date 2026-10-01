import { runInNewContext } from 'node:vm';

import isPlainObject from '@shared/utils/is-plain-object';

describe('isPlainObject', () => {
  it.each([{}, { vendor: { address: null } }, Object.create(null)])(
    'accepts plain objects %p',
    (value: unknown) => {
      expect(isPlainObject(value)).toBe(true);
    }
  );

  it('accepts JSON objects from another JavaScript context', () => {
    const value: unknown = runInNewContext('JSON.parse(\'{"vendor":{}}\')');
    expect(isPlainObject(value)).toBe(true);
  });

  it.each([
    null,
    undefined,
    'metadata',
    1,
    true,
    Symbol('metadata'),
    () => ({}),
    [],
    new Date(),
    /metadata/,
    new Map(),
    Object.create({ vendor: {} }),
    Object.create({ constructor: Object }),
  ])('rejects non-plain values %p', (value: unknown) => {
    expect(isPlainObject(value)).toBe(false);
  });

  it('rejects class instances in this and another JavaScript context', () => {
    class Vendor {
      address = null;
    }
    expect(isPlainObject(new Vendor())).toBe(false);
    expect(isPlainObject(runInNewContext('new (class Vendor {})()'))).toBe(
      false
    );
  });

  it('does not invoke a prototype constructor getter', () => {
    const getConstructor = jest.fn(() => Object);
    const prototype = Object.defineProperty({}, 'constructor', {
      get: getConstructor,
    });
    expect(isPlainObject(Object.create(prototype))).toBe(false);
    expect(getConstructor).not.toHaveBeenCalled();
  });
});
