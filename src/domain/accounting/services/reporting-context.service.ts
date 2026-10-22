import reportingContextEntity from '@domain/accounting/entities/reporting-context.entity';
import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';
import accountingError from '@domain/accounting/errors/accounting.error';
import IReportingContextRepo from '@domain/accounting/repos/reporting-context.repo';
import { EAccountingEntityStatus } from '@domain/accounting/types/accounting-entity.types';
import IReportingContextService from '@domain/accounting/types/reporting-context.service.types';

interface IDependencies {
  reportingContextRepo: IReportingContextRepo;
}

/**
 * Enforces ownership and one reporting context per accounting context
 * (ACC-RC-006). Storage uniqueness protects concurrent creation.
 */
function makeCreate(deps: IDependencies): IReportingContextService['create'] {
  return async (input, repoOptions) => {
    if (input.accountingEntity.status === EAccountingEntityStatus.Archived) {
      throw new accountingEntityError.Archived();
    }

    reportingContextEntity.validateIntervalSelection(
      input.accountingEntity.id,
      input.accountingContext,
      input.reportingInterval
    );

    const contextExists =
      await deps.reportingContextRepo.existsByAccountingContext(
        input.accountingContext.id,
        repoOptions
      );
    if (contextExists) {
      throw new accountingError.ReportingContextAlreadyExists();
    }

    return reportingContextEntity.make({
      accountingEntityId: input.accountingEntity.id,
      accountingContextId: input.accountingContext.id,
      reportingIntervalId: input.reportingInterval.id,
      reportingCurrencyCode: input.reportingCurrencyCode,
      name: input.name,
      description: input.description,
      createdBy: input.createdBy,
    });
  };
}

export default function makeReportingContextService(
  deps: IDependencies
): IReportingContextService {
  return Object.freeze({
    create: makeCreate(deps),
  });
}
