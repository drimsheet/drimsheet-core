import periodEntity from '@domain/accounting/entities/period.entity.deprecated';
import periodValidation from '@domain/accounting/entities/validations/period.validation';

describe('periodValidation', () => {
  it('exposes the frozen period validators', () => {
    expect(Object.isFrozen(periodValidation)).toBe(true);
    expect(periodEntity.validateUnit).toBe(periodValidation.validateUnit);
    expect(Object.keys(periodValidation)).toEqual([
      'isValidUnit',
      'validateUnit',
      'isValidStatus',
      'validateStatus',
      'validateStartAndEndDate',
    ]);
    expect(Object.values(periodValidation)).toEqual(
      expect.arrayContaining([expect.any(Function)])
    );
  });
});
