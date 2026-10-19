import reportingContextEntity from '@domain/accounting/entities/reporting-context.entity';
import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';
import { EAccountingEntityStatus } from '@domain/accounting/types/accounting-entity.types';
import IReportingContextService from '@domain/accounting/types/reporting-context.service.types';

function makeCreate(): IReportingContextService['create'] {
  return (input) => {
    if (input.accountingEntity.status === EAccountingEntityStatus.Archived) {
      throw new accountingEntityError.Archived();
    }

    reportingContextEntity.validatePeriodSelection(
      input.accountingEntity.id,
      input.accountingContext,
      input.reportingPeriod
    );

    return reportingContextEntity.make({
      accountingEntityId: input.accountingEntity.id,
      accountingContextId: input.accountingContext.id,
      currentReportingPeriodId: input.reportingPeriod.id,
      accountingStandardCode: input.accountingStandardCode,
      reportingCurrencyCode: input.reportingCurrencyCode,
      name: input.name,
      description: input.description,
      createdBy: input.createdBy,
    });
  };
}

export default function makeReportingContextService(): IReportingContextService {
  return Object.freeze({
    create: makeCreate(),
  });
}
