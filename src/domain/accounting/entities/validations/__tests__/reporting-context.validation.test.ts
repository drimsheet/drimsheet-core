import generateUUID from '@shared/utils/uuid-generator';

import accountingContextEntity from '@domain/accounting/entities/accounting-context.entity';
import accountingIntervalEntity from '@domain/accounting/entities/accounting-interval.entity';
import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';
import reportingContextEntity from '@domain/accounting/entities/reporting-context.entity';
import reportingIntervalEntity from '@domain/accounting/entities/reporting-interval.entity';
import reportingContextValidation from '@domain/accounting/entities/validations/reporting-context.validation';
import accountingError from '@domain/accounting/errors/accounting.error';

describe('reportingContextValidation', () => {
  const entityId = generateUUID();
  const createdBy = generateUUID();
  const [year] = fiscalYearEntity.make({
    accountingEntityId: entityId,
    createdBy,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    status: 'open',
  });
  const intervalPayload = {
    createdBy,
    accountingEntityId: entityId,
    fiscalYearId: year.id,
    startDate: year.startDate,
    endDate: new Date('2027-01-01'),
    unit: 'quarter' as const,
    count: 4,
    periods: ['Q1', 'Q2', 'Q3', 'Q4'].map((name) => ({ name })),
  };
  const [accountingInterval] = accountingIntervalEntity.make(intervalPayload);
  const [context] = accountingContextEntity.make({
    createdBy,
    accountingEntityId: entityId,
    fiscalYearId: year.id,
    accountingIntervalId: accountingInterval.id,
    accountingStandardCode: 'IFRS',
    name: 'Accounting context',
    description: null,
  });
  const [interval] = reportingIntervalEntity.make(intervalPayload);

  it('exposes the frozen validation API and accepts an interval in the same entity and year', () => {
    expect(Object.isFrozen(reportingContextValidation)).toBe(true);
    expect(reportingContextEntity.validateIntervalSelection).toBe(
      reportingContextValidation.validateIntervalSelection
    );
    expect(() =>
      reportingContextValidation.validateIntervalSelection(
        entityId,
        context,
        interval
      )
    ).not.toThrow();
  });

  it('rejects a context belonging to another entity', () => {
    expect(() =>
      reportingContextValidation.validateIntervalSelection(
        generateUUID(),
        context,
        interval
      )
    ).toThrow(accountingError.InvalidAccountingContextId);
  });

  it.each(['accountingEntityId', 'fiscalYearId'] as const)(
    'rejects an interval with a different %s',
    (field) => {
      expect(() =>
        reportingContextValidation.validateIntervalSelection(
          entityId,
          context,
          {
            ...interval,
            [field]: generateUUID(),
          }
        )
      ).toThrow(accountingError.InvalidReportingIntervalId);
    }
  );
});
