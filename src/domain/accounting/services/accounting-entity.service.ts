import accountingContextEntity from '@domain/accounting/entities/accounting-context.entity';
import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';
import getPeriodContainingCurrentDate from '@domain/accounting/entities/helpers/get-current-period.helper';
import getAccountingJurisdiction from '@domain/accounting/entities/helpers/get-jurisdiction.helper';
import reportingContextEntity from '@domain/accounting/entities/reporting-context.entity';
import reportingPeriodEntity from '@domain/accounting/entities/reporting-period.entity';
import accountingContextValidation from '@domain/accounting/entities/validations/accounting-context.validation';
import fiscalYearValidation from '@domain/accounting/entities/validations/fiscal-year.validation';
import errors from '@domain/accounting/errors/accounting-entity.error';
import IAccountingEntityRepo from '@domain/accounting/repos/accounting-entity.repo';
import accountingEntityServiceValidation from '@domain/accounting/services/validations/accounting-entity.validation';
import IAccountingEntityService from '@domain/accounting/types/accounting-entity.service.types';
import IAccountingPeriodService from '@domain/accounting/types/accounting-period.service.types';
import { EPeriodStatus } from '@domain/accounting/types/period.types';
import IJournalEntryRepo from '@domain/journal-entry/repos/journal-entry.repo';
import ledgerAccountBalanceEntity from '@domain/ledger/entities/ledger-account-balance.entity';
import ILedgerAccountBalanceRepo from '@domain/ledger/repos/ledger-account-balance.repo';
import { ILedgerAccountBalance } from '@domain/ledger/types/ledger-account-balance.types';
import currencyEntity from '@domain/money/entities/currency.entity';

interface IDependencies {
  ledgerAccountBalanceRepo: ILedgerAccountBalanceRepo;
  journalEntryRepo: IJournalEntryRepo;
  accountingPeriodService: IAccountingPeriodService;
  accountingEntityRepo: IAccountingEntityRepo;
}

/** Creates an accounting entity and its valid fiscal-year graph without persisting it. */
function makeCreate(deps: IDependencies): IAccountingEntityService['create'] {
  return async (input, repoOptions) => {
    await accountingEntityServiceValidation.validateExistingIndividualEntity(
      deps.accountingEntityRepo,
      input,
      repoOptions
    );

    const jurisdiction = getAccountingJurisdiction(input.jurisdictionCode);

    accountingContextValidation.validateStandardCodeAndJurisdiction(
      input.accountingStandardCode,
      input.jurisdictionCode,
      input.type
    );

    fiscalYearValidation.validateStartAndEndDate(input.fiscalYear);

    accountingEntityServiceValidation.validateFiscalYearLimit(
      jurisdiction,
      input.fiscalYear.startDate,
      input.fiscalYear.endDate
    );

    const functionalCurrency = currencyEntity.getByCode(
      input.functionalCurrencyCode
    );
    const reportingCurrency = currencyEntity.getByCode(
      input.reportingCurrencyCode
    );

    const accountingEntity = accountingEntityEntity.make({
      createdBy: input.createdBy,
      name: input.name,
      type: input.type,
      ownerId: input.ownerId,
      functionalCurrencyCode: functionalCurrency.code,
      jurisdictionCode: input.jurisdictionCode,
    });
    const fiscalYear = fiscalYearEntity.make({
      createdBy: input.createdBy,
      accountingEntityId: accountingEntity[0].id,
      startDate: input.fiscalYear.startDate,
      endDate: input.fiscalYear.endDate,
      status: EPeriodStatus.Open,
    });

    const accountingPeriods = await deps.accountingPeriodService.generate(
      {
        createdBy: input.createdBy,
        accountingEntityId: accountingEntity[0].id,
        unit: input.accountingPeriod.unit,
        count: input.accountingPeriod.count,
        fiscalYear: fiscalYear[0],
      },
      repoOptions
    );

    const currentAccountingPeriod =
      getPeriodContainingCurrentDate(
        accountingPeriods.map(([entity]) => entity)
      ) ?? accountingPeriods[0][0];

    const accountingContext = accountingContextEntity.make({
      createdBy: input.createdBy,
      name: 'Default Accounting Context',
      description: null,
      accountingEntityId: accountingEntity[0].id,
      accountingStandardCode: input.accountingStandardCode,
      fiscalYearId: fiscalYear[0].id,
      currentAccountingPeriodId: currentAccountingPeriod.id,
    });

    const reportingPeriods = reportingPeriodEntity.make({
      createdBy: input.createdBy,
      accountingEntityId: accountingEntity[0].id,
      unit: input.reportingPeriod.unit,
      count: input.reportingPeriod.count,
      fiscalYear: fiscalYear[0],
    });

    const currentReportingPeriod =
      getPeriodContainingCurrentDate(
        reportingPeriods.map(([entity]) => entity)
      ) ?? reportingPeriods[0][0];

    const reportingContext = reportingContextEntity.make({
      createdBy: input.createdBy,
      name: 'Default Reporting Context',
      description: null,
      accountingEntityId: accountingEntity[0].id,
      reportingCurrencyCode: reportingCurrency.code,
      accountingContextId: accountingContext[0].id,
      currentReportingPeriodId: currentReportingPeriod.id,
      accountingStandardCode: input.accountingStandardCode,
    });

    return Object.freeze({
      accountingEntity,
      fiscalYear,
      accountingPeriods,
      accountingContext,
      reportingPeriods,
      reportingContext,
    });
  };
}

/** Checks currency eligibility and prepares entity and functional balance transitions without persisting. */
function makeUpdate(deps: IDependencies): IAccountingEntityService['update'] {
  return async (current, changes, repoOptions) => {
    const hasCurrencyChange =
      changes.functionalCurrencyCode !== undefined &&
      changes.functionalCurrencyCode !== current.functionalCurrencyCode;
    if (hasCurrencyChange) {
      await accountingEntityServiceValidation.validateFunctionalCurrencyChange(
        deps.journalEntryRepo,
        current.id,
        repoOptions
      );
    }
    const accountingEntity = accountingEntityEntity.update(current, changes);
    const [entity] = accountingEntity;
    const updatedBalances: ILedgerAccountBalance[] = [];

    if (hasCurrencyChange) {
      const balances =
        await deps.ledgerAccountBalanceRepo.findAllByAccountingEntityId(
          entity.id,
          repoOptions
        );
      const currency = currencyEntity.getByCode(entity.functionalCurrencyCode);

      for (const balance of balances) {
        const hasCurrencyMismatch =
          balance.functionalAmount.currency.code !==
          current.functionalCurrencyCode;

        if (hasCurrencyMismatch) {
          throw new errors.FunctionalCurrencyMismatch({
            accountingEntityId: current.id,
            ledgerAccountId: balance.ledgerAccountId,
            expectedCurrencyCode: current.functionalCurrencyCode,
            actualCurrencyCode: balance.functionalAmount.currency.code,
          });
        }

        const updatedBalance =
          ledgerAccountBalanceEntity.changeFunctionalCurrency(
            balance,
            currency
          );

        updatedBalances.push(updatedBalance);
      }
    }

    return Object.freeze({ accountingEntity, updatedBalances });
  };
}

/** Validates journal references before preparing deletion; never persists or publishes. */
function makeDelete(deps: IDependencies): IAccountingEntityService['delete'] {
  return async (current, repoOptions) => {
    await accountingEntityServiceValidation.validateDeletionAllowed(
      deps.journalEntryRepo,
      current.id,
      repoOptions
    );
    return accountingEntityEntity.delete(current);
  };
}

/** Determines ownership-based access to the accounting entity. */
function makeGrantUserAccess(): IAccountingEntityService['grantUserAccess'] {
  return (accountingEntity, userId) => accountingEntity.ownerId === userId;
}

/** Rejects access by anyone other than the accounting entity's owner. */
function makeValidateAccess(
  grantUserAccess: IAccountingEntityService['grantUserAccess']
): IAccountingEntityService['validateAccess'] {
  return (accountingEntity, userId) => {
    if (!grantUserAccess(accountingEntity, userId)) {
      throw new errors.Unauthorized();
    }
  };
}

export default function makeAccountingEntityService(
  deps: IDependencies
): IAccountingEntityService {
  const grantUserAccess = makeGrantUserAccess();
  return Object.freeze({
    create: makeCreate(deps),
    update: makeUpdate(deps),
    delete: makeDelete(deps),
    grantUserAccess,
    validateAccess: makeValidateAccess(grantUserAccess),
  });
}
