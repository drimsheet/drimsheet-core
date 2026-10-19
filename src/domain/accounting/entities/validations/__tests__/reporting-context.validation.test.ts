import generateUUID from '@shared/utils/uuid-generator';

import accountingContextEntity from '@domain/accounting/entities/accounting-context.entity';
import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';
import reportingContextEntity from '@domain/accounting/entities/reporting-context.entity';
import reportingPeriodEntity from '@domain/accounting/entities/reporting-period.entity';
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
  const [context] = accountingContextEntity.make({
    createdBy,
    accountingEntityId: entityId,
    fiscalYearId: year.id,
    currentAccountingPeriodId: generateUUID(),
    accountingStandardCode: 'IFRS',
    name: 'Accounting context',
    description: null,
  });
  const [[period]] = reportingPeriodEntity.make({
    createdBy,
    accountingEntityId: entityId,
    fiscalYear: year,
    unit: 'quarter',
    count: 4,
  });

  it('exposes the frozen validation API and accepts a period in the same entity and year', () => {
    expect(Object.isFrozen(reportingContextValidation)).toBe(true);
    expect(reportingContextEntity.validatePeriodSelection).toBe(
      reportingContextValidation.validatePeriodSelection
    );
    expect(() =>
      reportingContextValidation.validatePeriodSelection(
        entityId,
        context,
        period
      )
    ).not.toThrow();
  });

  it('rejects a context belonging to another entity', () => {
    expect(() =>
      reportingContextValidation.validatePeriodSelection(
        generateUUID(),
        context,
        period
      )
    ).toThrow(accountingError.InvalidAccountingContextId);
  });

  it.each(['accountingEntityId', 'fiscalYearId'] as const)(
    'rejects a period with a different %s',
    (field) => {
      expect(() =>
        reportingContextValidation.validatePeriodSelection(entityId, context, {
          ...period,
          [field]: generateUUID(),
        })
      ).toThrow(accountingError.InvalidCurrentReportingPeriodId);
    }
  );
});
