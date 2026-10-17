import generateUUID from '@shared/utils/uuid-generator';

import accountingContextEntity from '@domain/accounting/entities/accounting-context.entity';
import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import accountingPeriodEntity from '@domain/accounting/entities/accounting-period.entity';
import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';
import accountingContextValidation from '@domain/accounting/entities/validations/accounting-context.validation';
import accountingError from '@domain/accounting/errors/accounting.error';
import jurisdictionError from '@domain/accounting/errors/jurisdiction.error';
import { EPeriodStatus } from '@domain/accounting/types/period.types';

describe('accountingContextValidation', () => {
  it('exposes the frozen accounting-context validators', () => {
    expect(Object.isFrozen(accountingContextValidation)).toBe(true);
    expect(accountingContextEntity.validateAccountingStandardCode).toBe(
      accountingContextValidation.validateAccountingStandardCode
    );
    expect(Object.keys(accountingContextValidation)).toEqual([
      'validatePeriodSelection',
      'isValidAccountingStandardCode',
      'validateAccountingStandardCode',
      'validateStandardCode',
      'validateStandardCodeAndJurisdiction',
    ]);
    expect(Object.values(accountingContextValidation)).toEqual(
      expect.arrayContaining([expect.any(Function)])
    );
  });

  it('rejects an invalid jurisdiction for an accounting standard', () => {
    expect(() =>
      accountingContextValidation.validateStandardCodeAndJurisdiction(
        'IFRS',
        'INVALID',
        'individual'
      )
    ).toThrow(jurisdictionError.Invalid);
  });
});

describe('accounting-context period selection', () => {
  const actorId = generateUUID();
  const entity = accountingEntityEntity.make({
    createdBy: actorId,
    ownerId: generateUUID(),
    name: 'Business',
    type: 'private_company',
    functionalCurrencyCode: 'NGN',
    jurisdictionCode: 'NG',
  })[0];

  function makeCalendar(yearNumber: number) {
    jest.setSystemTime(new Date(`${yearNumber}-01-01`));
    const year = fiscalYearEntity.make({
      accountingEntityId: entity.id,
      createdBy: actorId,
      startDate: new Date(`${yearNumber}-01-01`),
      endDate: new Date(`${yearNumber}-12-31`),
      status: 'open',
    })[0];
    const period = accountingPeriodEntity.make({
      accountingEntityId: entity.id,
      createdBy: actorId,
      fiscalYear: year,
      unit: 'month',
      count: 12,
    })[3][0];
    jest.setSystemTime(new Date('2026-10-17'));
    return { year, period };
  }

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-17'));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it.each([2025, 2026, 2027])(
    'accepts an explicitly selected period in year %s regardless of today',
    (yearNumber) => {
      const { year, period } = makeCalendar(yearNumber);
      expect(() =>
        accountingContextValidation.validatePeriodSelection(
          entity.id,
          year,
          period
        )
      ).not.toThrow();
    }
  );

  it.each(Object.values(EPeriodStatus))(
    'does not change or reject the selected period status %s',
    (status) => {
      const { year, period } = makeCalendar(2026);
      const selected = Object.freeze({ ...period, status });
      const before = JSON.stringify(selected);
      expect(() =>
        accountingContextValidation.validatePeriodSelection(
          entity.id,
          year,
          selected
        )
      ).not.toThrow();
      expect(JSON.stringify(selected)).toBe(before);
    }
  );

  it('rejects a fiscal year owned by another entity', () => {
    const { year, period } = makeCalendar(2026);
    expect(() =>
      accountingContextValidation.validatePeriodSelection(
        generateUUID(),
        year,
        period
      )
    ).toThrow(accountingError.InvalidFiscalYearId);
  });

  it.each(['accountingEntityId', 'fiscalYearId'] as const)(
    'rejects a period with mismatched %s',
    (field) => {
      const { year, period } = makeCalendar(2026);
      expect(() =>
        accountingContextValidation.validatePeriodSelection(entity.id, year, {
          ...period,
          [field]: generateUUID(),
        })
      ).toThrow(accountingError.InvalidCurrentAccountingPeriodId);
    }
  );
});
