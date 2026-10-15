import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import accountingEntityValidation from '@domain/accounting/entities/validations/accounting-entity.validation';

describe('accountingEntityValidation', () => {
  it('exposes the frozen accounting-entity validators', () => {
    expect(Object.isFrozen(accountingEntityValidation)).toBe(true);
    expect(accountingEntityEntity.validateType).toBe(
      accountingEntityValidation.validateType
    );
    expect(Object.keys(accountingEntityValidation)).toEqual([
      'isValidType',
      'validateType',
      'validateTypeChange',
      'isValidJurisdictionCode',
      'validateJurisdictionCode',
      'isValidHistoryAction',
      'validateHistoryAction',
    ]);
    expect(Object.values(accountingEntityValidation)).toEqual(
      expect.arrayContaining([expect.any(Function)])
    );
  });
});
