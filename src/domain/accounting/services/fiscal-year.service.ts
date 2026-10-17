import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';
import getAccountingJurisdiction from '@domain/accounting/entities/helpers/get-jurisdiction.helper';
import periodError from '@domain/accounting/errors/period.error';
import IFiscalYearRepo from '@domain/accounting/repos/fiscal-year.repo';
import accountingEntityValidation from '@domain/accounting/services/validations/accounting-entity.validation';
import IFiscalYearService from '@domain/accounting/types/fiscal-year.service.types';

interface IDependencies {
  fiscalYearRepo: IFiscalYearRepo;
}

/** Enforces fiscal-year validity and stored non-overlap; storage rejects concurrent conflicts. */
function makeCreate(deps: IDependencies): IFiscalYearService['create'] {
  return async (input, options) => {
    const creation = fiscalYearEntity.make({
      accountingEntityId: input.accountingEntity.id,
      createdBy: input.createdBy,
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      status: input.status,
    });
    const jurisdiction = getAccountingJurisdiction(
      input.accountingEntity.jurisdictionCode
    );
    accountingEntityValidation.validateFiscalYearLimit(
      jurisdiction,
      input.startDate,
      input.endDate
    );

    const hasOverlap = await deps.fiscalYearRepo.existsByRange(
      input.accountingEntity.id,
      { startDate: input.startDate, endDate: input.endDate },
      options
    );

    if (hasOverlap) {
      throw new periodError.OverlappingFiscalYears({
        accountingEntityId: input.accountingEntity.id,
        startDate: input.startDate,
        endDate: input.endDate,
      });
    }
    return creation;
  };
}

export default function makeFiscalYearService(
  deps: IDependencies
): IFiscalYearService {
  return Object.freeze({ create: makeCreate(deps) });
}
