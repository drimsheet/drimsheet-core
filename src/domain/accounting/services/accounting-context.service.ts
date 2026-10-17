import accountingContextEntity from '@domain/accounting/entities/accounting-context.entity';
import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';
import IAccountingContextService from '@domain/accounting/types/accounting-context.service.types';
import { EAccountingEntityStatus } from '@domain/accounting/types/accounting-entity.types';

/** Rejects archived entities and enforces ACC-AC-001 through ACC-AC-004; selection never changes period status or posting eligibility. */
function makeCreate(): IAccountingContextService['create'] {
  return (input) => {
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

    return accountingContextEntity.make({
      accountingEntityId: input.accountingEntity.id,
      fiscalYearId: input.fiscalYear.id,
      currentAccountingPeriodId: input.accountingPeriod.id,
      accountingStandardCode: input.accountingStandardCode,
      name: input.name,
      description: input.description,
      createdBy: input.createdBy,
    });
  };
}

export default function makeAccountingContextService(): IAccountingContextService {
  return Object.freeze({ create: makeCreate() });
}
