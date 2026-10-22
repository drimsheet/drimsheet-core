import generateUUID from '@shared/utils/uuid-generator';

import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';
import reportingPeriodValidation from '@domain/accounting/entities/validations/reporting-period.validation.deprecated';
import periodError from '@domain/accounting/errors/period.error';

describe('reportingPeriodValidation', () => {
  const [year] = fiscalYearEntity.make({
    createdBy: generateUUID(),
    accountingEntityId: generateUUID(),
    startDate: new Date('2092-01-01'),
    endDate: new Date('2092-12-31'),
    status: 'open',
  });
  it('accepts the fiscal-year owner', () => {
    expect(() =>
      reportingPeriodValidation.validateFiscalYearOwnership(
        year.accountingEntityId,
        year
      )
    ).not.toThrow();
  });
  it('rejects another entity', () => {
    expect(() =>
      reportingPeriodValidation.validateFiscalYearOwnership(
        generateUUID(),
        year
      )
    ).toThrow(periodError.InvalidAccountingEntityId);
  });

  it('allows overlapping intervals within the fiscal year', () => {
    const interval = { startDate: year.startDate, endDate: year.endDate };
    expect(() =>
      reportingPeriodValidation.validateFiscalYearBounds(
        [interval, interval],
        year
      )
    ).not.toThrow();
  });

  it.each([
    ['2091-12-31', '2092-01-31'],
    ['2092-12-01', '2093-01-01'],
    ['2092-03-01', '2092-02-29'],
  ])(
    'rejects intervals outside or reversed within the fiscal year: %s–%s',
    (start, end) => {
      expect(() =>
        reportingPeriodValidation.validateFiscalYearBounds(
          [{ startDate: new Date(start), endDate: new Date(end) }],
          year
        )
      ).toThrow(periodError.InvalidInterval);
    }
  );
});
