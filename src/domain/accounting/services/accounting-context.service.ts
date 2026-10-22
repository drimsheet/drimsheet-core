import accountingContextEntity from '@domain/accounting/entities/accounting-context.entity';
import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';
import accountingError from '@domain/accounting/errors/accounting.error';
import IAccountingContextRepo from '@domain/accounting/repos/accounting-context.repo';
import IAccountingContextService from '@domain/accounting/types/accounting-context.service.types';
import { EAccountingEntityStatus } from '@domain/accounting/types/accounting-entity.types';

interface IDependencies {
  accountingContextRepo: IAccountingContextRepo;
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

export default function makeAccountingContextService(
  deps: IDependencies
): IAccountingContextService {
  return Object.freeze({
    create: makeCreate(deps),
  });
}
