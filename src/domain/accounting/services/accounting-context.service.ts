import accountingContextEntity from '@domain/accounting/entities/accounting-context.entity';
import getAccountingPeriodNeighborsHelper from '@domain/accounting/entities/helpers/get-accounting-period-neighbors.helper';
import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';
import accountingError from '@domain/accounting/errors/accounting.error';
import IAccountingContextRepo from '@domain/accounting/repos/accounting-context.repo';
import IAccountingPeriodRepo from '@domain/accounting/repos/accounting-period.repo.deprecated';
import IFiscalYearRepo from '@domain/accounting/repos/fiscal-year.repo';
import IAccountingContextService from '@domain/accounting/types/accounting-context.service.types';
import { EAccountingEntityStatus } from '@domain/accounting/types/accounting-entity.types';

interface IDependencies {
  accountingContextRepo: IAccountingContextRepo;
  accountingPeriodRepo: IAccountingPeriodRepo;
  fiscalYearRepo: IFiscalYearRepo;
}

/**
 * Enforces eligibility and one context per fiscal year (ACC-AC-005), then
 * prepares the interval-based context, event, and audit.
 * Storage uniqueness protects against concurrent creation.
 */
function makeCreate(deps: IDependencies): IAccountingContextService['create'] {
  return async (input, repoOptions) => {
    if (input.accountingEntity.status === EAccountingEntityStatus.Archived) {
      throw new accountingEntityError.Archived();
    }

    accountingContextEntity.validateIntervalSelection(
      input.accountingEntity.id,
      input.fiscalYear,
      input.accountingInterval
    );
    accountingContextEntity.validateStandardCodeAndJurisdiction(
      input.accountingStandardCode,
      input.accountingEntity.jurisdictionCode,
      input.accountingEntity.type
    );

    const contextExists = await deps.accountingContextRepo.existsByFiscalYear(
      input.fiscalYear.id,
      repoOptions
    );
    if (contextExists) {
      throw new accountingError.AccountingContextAlreadyExists();
    }

    return accountingContextEntity.make({
      accountingEntityId: input.accountingEntity.id,
      fiscalYearId: input.fiscalYear.id,
      accountingStandardCode: input.accountingStandardCode,
      name: input.name,
      description: input.description,
      accountingIntervalId: input.accountingInterval.id,
      createdBy: input.createdBy,
    });
  };
}

/** Loads the context and its fiscal-year periods to prepare the next selection. */
function makeUpdateCurrentAccountingPeriod(
  deps: IDependencies
): IAccountingContextService['updateCurrentAccountingPeriod'] {
  return async (input, repoOptions) => {
    const context = await deps.accountingContextRepo.findById(
      input.accountingContextId,
      repoOptions
    );
    if (!context) {
      throw new accountingError.AccountingContextNotFound();
    }

    const fiscalYear = await deps.fiscalYearRepo.findById(
      context.accountingEntityId,
      context.fiscalYearId,
      repoOptions
    );
    if (!fiscalYear) {
      throw new accountingError.FiscalYearNotFound();
    }

    const periods = await deps.accountingPeriodRepo.findByRange(
      context.accountingEntityId,
      { startDate: fiscalYear.startDate, endDate: fiscalYear.endDate },
      repoOptions
    );
    const fiscalYearPeriods = periods.filter(
      (period) => period.fiscalYearId === context.fiscalYearId
    );
    const nextPeriod = fiscalYearPeriods.find(
      (period) => period.id === input.previousState.nextAccountingPeriod
    );
    if (!nextPeriod) {
      throw new accountingError.InvalidNextAccountingPeriodId();
    }
    accountingContextEntity.validatePeriodSelection(
      context.accountingEntityId,
      fiscalYear,
      nextPeriod
    );
    const neighbors = getAccountingPeriodNeighborsHelper(
      fiscalYearPeriods,
      nextPeriod.id
    );
    if (
      neighbors.previousAccountingPeriodId !==
      input.previousState.currentAccountPeriod
    ) {
      throw new accountingError.InvalidPreviousAccountingPeriodId();
    }

    const isAlreadyApplied =
      context.previousAccountingPeriodId ===
        input.previousState.currentAccountPeriod &&
      context.currentAccountingPeriodId ===
        input.previousState.nextAccountingPeriod &&
      context.nextAccountingPeriodId === neighbors.nextAccountingPeriodId;
    if (!isAlreadyApplied) {
      if (
        context.currentAccountingPeriodId !==
        input.previousState.currentAccountPeriod
      ) {
        throw new accountingError.InvalidCurrentAccountingPeriodId();
      }
      if (
        context.nextAccountingPeriodId !==
        input.previousState.nextAccountingPeriod
      ) {
        throw new accountingError.InvalidNextAccountingPeriodId();
      }
    }

    return accountingContextEntity.update(context, {
      previousAccountingPeriodId: input.previousState.currentAccountPeriod,
      currentAccountingPeriodId: input.previousState.nextAccountingPeriod,
      nextAccountingPeriodId: neighbors.nextAccountingPeriodId,
    });
  };
}

export default function makeAccountingContextService(
  deps: IDependencies
): IAccountingContextService {
  return Object.freeze({
    create: makeCreate(deps),
    updateCurrentAccountingPeriod: makeUpdateCurrentAccountingPeriod(deps),
  });
}
