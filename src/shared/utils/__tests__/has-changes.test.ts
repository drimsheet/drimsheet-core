import hasChanges from '@shared/utils/has-changes';

describe('hasChanges', () => {
  const obj: { name: string; description: string | null; count?: number } = {
    name: 'Original',
    description: 'Description',
    count: 1,
  };

  it('returns false for an empty comparison', () => {
    expect(hasChanges(obj, {})).toBe(false);
  });

  it('compares only supplied fields', () => {
    expect(hasChanges(obj, { name: 'Original' })).toBe(false);
    expect(hasChanges(obj, { name: 'Original', count: 2 })).toBe(true);
  });

  it('compares null and undefined literally', () => {
    expect(hasChanges(obj, { description: null })).toBe(true);
    expect(hasChanges(obj, { count: undefined })).toBe(true);
    expect(hasChanges({ description: null }, { description: null })).toBe(
      false
    );
    expect(hasChanges({ count: undefined }, { count: undefined })).toBe(false);
  });

  it('uses reference equality for object values', () => {
    const details = { count: 1 };
    expect(hasChanges({ details }, { details })).toBe(false);
    expect(hasChanges({ details }, { details: { count: 1 } })).toBe(true);
  });

  it('stops at the first difference', () => {
    const comparison = {
      name: 'Changed',
      get count(): number {
        throw new Error('Should not read fields after a difference');
      },
    };

    expect(hasChanges(obj, comparison)).toBe(true);
  });
});
