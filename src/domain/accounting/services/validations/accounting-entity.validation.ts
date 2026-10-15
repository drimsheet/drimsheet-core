import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import dateUtils from '@shared/utils/date';

import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';
import periodError from '@domain/accounting/errors/period.error';
import IAccountingEntityRepo from '@domain/accounting/repos/accounting-entity.repo';
import { IAccountingEntityCreationInput } from '@domain/accounting/types/accounting-entity.service.types';
import { EAccountingEntityType } from '@domain/accounting/types/accounting-entity.types';
import { IJurisdiction } from '@domain/accounting/types/jurisdiction.types';
import IJournalEntryRepo from '@domain/journal-entry/repos/journal-entry.repo';

function validateFiscalYearLimit(
  jurisdiction: IJurisdiction,
  startDate: Date,
  endDate: Date
) {
  const { maxFiscalMonths } = jurisdiction;

  if (!Number.isInteger(maxFiscalMonths) || maxFiscalMonths <= 0) {
    throw new periodError.InvalidDateRange({
      jurisdictionCode: jurisdiction.code,
      maxFiscalMonths,
    });
  }

  const maximumEndDate = dateUtils.addMonthsToDate(startDate, maxFiscalMonths);

  if (endDate > maximumEndDate) {
    throw new periodError.FiscalYearExceedsJurisdictionLimit({
      jurisdictionCode: jurisdiction.code,
      maxFiscalMonths,
      startDate,
      endDate,
      maximumEndDate,
    });
  }
}

async function validateExistingIndividualEntity(
  repo: IAccountingEntityRepo,
  input: IAccountingEntityCreationInput,
  repoOptions: IReadRepoOptions
) {
  if (input.type !== EAccountingEntityType.Individual) {
    return;
  }

  const existingIndividualEntities = await repo.findByUserId(
    input.ownerId,
    repoOptions,
    EAccountingEntityType.Individual
  );

  if (existingIndividualEntities.length > 0) {
    throw new accountingEntityError.OnlyOneIndividualAccountingEntityAllowed({
      ownerId: input.ownerId,
    });
  }
}

async function validateFunctionalCurrencyChange(
  repo: IJournalEntryRepo,
  accountingEntityId: TEntityId,
  repoOptions: IReadRepoOptions
) {
  const hasEntries = await repo.existsByAccountingEntityId(
    accountingEntityId,
    repoOptions
  );
  if (hasEntries) {
    throw new accountingEntityError.FunctionalCurrencyChangeNotAllowed({
      accountingEntityId,
    });
  }
}

const accountingEntityValidation = Object.freeze({
  validateFiscalYearLimit,
  validateFunctionalCurrencyChange,
  validateExistingIndividualEntity,
});

export default accountingEntityValidation;
