import dateUtils from '@shared/utils/date';

import reportingContextEntity from '@domain/accounting/entities/reporting-context.entity';
import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';
import accountingError from '@domain/accounting/errors/accounting.error';
import IAccountingContextRepo from '@domain/accounting/repos/accounting-context.repo';
import IReportingContextRepo from '@domain/accounting/repos/reporting-context.repo';
import IReportingPeriodRepo from '@domain/accounting/repos/reporting-period.repo';
import { EAccountingEntityStatus } from '@domain/accounting/types/accounting-entity.types';
import IReportingContextService from '@domain/accounting/types/reporting-context.service.types';

interface IDependencies {
  reportingContextRepo: IReportingContextRepo;
  accountingContextRepo: IAccountingContextRepo;
  reportingPeriodRepo: IReportingPeriodRepo;
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

    reportingContextEntity.validatePeriodSelection(
      input.accountingEntity.id,
      input.accountingContext,
      input.reportingPeriod
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
      currentReportingPeriodId: input.reportingPeriod.id,
      accountingStandardCode: input.accountingStandardCode,
      reportingCurrencyCode: input.reportingCurrencyCode,
      name: input.name,
      description: input.description,
      createdBy: input.createdBy,
    });
  };
}

/** Loads the context and adjacent periods to prepare the next selection. */
function makeUpdateCurrentReportingPeriod(
  deps: IDependencies
): IReportingContextService['updateCurrentReportingPeriod'] {
  return async (input, repoOptions) => {
    const context = await deps.reportingContextRepo.findById(
      input.reportingContextId,
      repoOptions
    );
    if (!context) {
      throw new accountingError.ReportingContextNotFound();
    }

    const accountingContext = await deps.accountingContextRepo.findById(
      context.accountingContextId,
      repoOptions
    );
    if (!accountingContext) {
      throw new accountingError.AccountingContextNotFound();
    }

    const currentPeriod = await deps.reportingPeriodRepo.findById(
      input.previousState.currentReportingPeriod,
      repoOptions
    );
    if (!currentPeriod) {
      throw new accountingError.InvalidCurrentReportingPeriodId();
    }
    reportingContextEntity.validatePeriodSelection(
      context.accountingEntityId,
      accountingContext,
      currentPeriod
    );

    const nextPeriod = await deps.reportingPeriodRepo.findById(
      input.previousState.nextReportingPeriod,
      repoOptions
    );
    if (!nextPeriod) {
      throw new accountingError.InvalidNextReportingPeriodId();
    }
    reportingContextEntity.validatePeriodSelection(
      context.accountingEntityId,
      accountingContext,
      nextPeriod
    );

    const isAdjacentPeriod = dateUtils.isSameUtcDay(
      nextPeriod.startDate,
      dateUtils.addUtcCalendarUnits(currentPeriod.endDate, 1, 'day')
    );
    if (!isAdjacentPeriod) {
      throw new accountingError.InvalidNextReportingPeriodId();
    }

    const isAlreadyApplied = context.currentReportingPeriodId === nextPeriod.id;
    const hasStaleCurrentPeriod =
      !isAlreadyApplied &&
      context.currentReportingPeriodId !== currentPeriod.id;
    if (hasStaleCurrentPeriod) {
      throw new accountingError.InvalidCurrentReportingPeriodId();
    }

    return reportingContextEntity.update(context, {
      currentReportingPeriodId: nextPeriod.id,
    });
  };
}

export default function makeReportingContextService(
  deps: IDependencies
): IReportingContextService {
  return Object.freeze({
    create: makeCreate(deps),
    updateCurrentReportingPeriod: makeUpdateCurrentReportingPeriod(deps),
  });
}
