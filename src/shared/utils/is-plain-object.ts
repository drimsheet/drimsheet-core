/** Accepts plain objects across JavaScript contexts, including null prototypes. */
export default function isPlainObject(value: unknown): boolean {
  const isObject = value !== null && typeof value === 'object';
  if (!isObject) return false;

  const prototype: object | null = Object.getPrototypeOf(value);
  if (prototype === null) return true;

  const constructor: unknown = Object.getOwnPropertyDescriptor(
    prototype,
    'constructor'
  )?.value;

  // Object constructors differ by context, so compare their native definitions.
  // The prototype identity check excludes objects inheriting a forged constructor.
  const hasObjectConstructor =
    typeof constructor === 'function' &&
    constructor.prototype === prototype &&
    Function.prototype.toString.call(constructor) ===
      Function.prototype.toString.call(Object);

  return hasObjectConstructor;
}
