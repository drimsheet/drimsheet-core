/** Compares supplied enumerable string keys using strict equality. */
export default function hasChanges<T extends object>(
  obj: T,
  comparison: Partial<T>
): boolean {
  for (const property of Object.keys(comparison) as (keyof T)[]) {
    if (comparison[property] !== obj[property]) {
      return true;
    }
  }

  return false;
}
