import accountingContextEntity from '@domain/accounting/entities/accounting-context.entity';
import getAccountingPeriodNeighborsHelper from '@domain/accounting/entities/helpers/get-accounting-period-neighbors.helper';
import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';
import IAccountingPeriodRepo from '@domain/accounting/repos/accounting-period.repo';
import IAccountingContextService from '@domain/accounting/types/accounting-context.service.types';
import { EAccountingEntityStatus } from '@domain/accounting/types/accounting-entity.types';

interface IDependencies {
  accountingPeriodRepo: IAccountingPeriodRepo;
}

/**
 * Enforces context eligibility and resolves neighboring periods from storage before preparing the context, event, and audit.
 * */
function makeCreate(deps: IDependencies): IAccountingContextService['create'] {
  return async (input, repoOptions) => {
    if (input.accountingEntity.status === EAccountingEntityStatus.Archived) {
      throw new accountingEntityError.Archived();
    }

    accountingContextEntity.validatePeriodSelection(
      input.accountingEntity.id,
      input.fiscalYear,
      input.accountingPeriod
    );
    accountingContextEntity.validateAccountingStandardCode(
      input.accountingStandardCode
    );
    accountingContextEntity.validateStandardCodeAndJurisdiction(
      input.accountingStandardCode,
      input.accountingEntity.jurisdictionCode,
      input.accountingEntity.type
    );

    const periods = await deps.accountingPeriodRepo.findByRange(
      input.accountingEntity.id,
      {
        startDate: input.fiscalYear.startDate,
        endDate: input.fiscalYear.endDate,
      },
      repoOptions
    );
    const neighbors = getAccountingPeriodNeighborsHelper(
      periods,
      input.accountingPeriod.id
    );

    return accountingContextEntity.make({
      accountingEntityId: input.accountingEntity.id,
      fiscalYearId: input.fiscalYear.id,
      accountingStandardCode: input.accountingStandardCode,
      name: input.name,
      description: input.description,
      currentAccountingPeriodId: input.accountingPeriod.id,
      previousAccountingPeriodId: neighbors.previousAccountingPeriodId,
      nextAccountingPeriodId: neighbors.nextAccountingPeriodId,
      createdBy: input.createdBy,
    });
  };
}

export default function makeAccountingContextService(
  deps: IDependencies
): IAccountingContextService {
  return Object.freeze({
    create: makeCreate(deps),
  });
}
