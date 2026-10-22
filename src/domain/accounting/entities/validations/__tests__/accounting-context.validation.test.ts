import generateUUID from '@shared/utils/uuid-generator';

import accountingContextEntity from '@domain/accounting/entities/accounting-context.entity';
import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import accountingIntervalEntity from '@domain/accounting/entities/accounting-interval.entity';
import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';
import accountingContextValidation from '@domain/accounting/entities/validations/accounting-context.validation';
import accountingError from '@domain/accounting/errors/accounting.error';
import jurisdictionError from '@domain/accounting/errors/jurisdiction.error';

describe('accountingContextValidation', () => {
  it('exposes the frozen accounting-context validators', () => {
    expect(Object.isFrozen(accountingContextValidation)).toBe(true);
    expect(accountingContextEntity.validateAccountingStandardCode).toBe(
      accountingContextValidation.validateAccountingStandardCode
    );
    expect(Object.keys(accountingContextValidation)).toEqual([
      'validateIntervalSelection',
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

describe('accounting-context interval selection', () => {
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
    const [interval] = accountingIntervalEntity.make({
      accountingEntityId: entity.id,
      createdBy: actorId,
      fiscalYearId: year.id,
      startDate: year.startDate,
      endDate: new Date(`${yearNumber + 1}-01-01`),
      unit: 'month',
      count: 12,
      periods: Array.from({ length: 12 }, (_, index) => ({
        name: `Month ${index + 1}`,
      })),
    });
    jest.setSystemTime(new Date('2026-10-17'));
    return { year, interval };
  }

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-17'));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it.each([2025, 2026, 2027])(
    'accepts an explicitly referenced interval in year %s regardless of today',
    (yearNumber) => {
      const { year, interval } = makeCalendar(yearNumber);
      expect(() =>
        accountingContextValidation.validateIntervalSelection(
          entity.id,
          year,
          interval
        )
      ).not.toThrow();
    }
  );

  it.each([0, 3, 11])(
    'leaves current-period selection %s owned by the interval',
    (ordinal) => {
      const { year, interval } = makeCalendar(2026);
      const [selected] = accountingIntervalEntity.updateCurrentPeriod(
        interval,
        new Date(Date.UTC(2026, ordinal, 1))
      );
      const before = JSON.stringify(selected);
      expect(() =>
        accountingContextValidation.validateIntervalSelection(
          entity.id,
          year,
          selected
        )
      ).not.toThrow();
      expect(JSON.stringify(selected)).toBe(before);
    }
  );

  it('rejects a fiscal year owned by another entity', () => {
    const { year, interval } = makeCalendar(2026);
    expect(() =>
      accountingContextValidation.validateIntervalSelection(
        generateUUID(),
        year,
        interval
      )
    ).toThrow(accountingError.InvalidFiscalYearId);
  });

  it.each(['accountingEntityId', 'fiscalYearId'] as const)(
    'rejects an interval with mismatched %s',
    (field) => {
      const { year, interval } = makeCalendar(2026);
      expect(() =>
        accountingContextValidation.validateIntervalSelection(entity.id, year, {
          ...interval,
          [field]: generateUUID(),
        })
      ).toThrow(accountingError.InvalidAccountingIntervalId);
    }
  );
});
