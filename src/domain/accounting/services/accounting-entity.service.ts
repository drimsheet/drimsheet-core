import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import errors from '@domain/accounting/errors/accounting-entity.error';
import IAccountingEntityRepo from '@domain/accounting/repos/accounting-entity.repo';
import accountingEntityServiceValidation from '@domain/accounting/services/validations/accounting-entity.validation';
import IAccountingEntityService from '@domain/accounting/types/accounting-entity.service.types';
import IJournalEntryRepo from '@domain/journal-entry/repos/journal-entry.repo';
import ledgerAccountBalanceEntity from '@domain/ledger/entities/ledger-account-balance.entity';
import ILedgerAccountBalanceRepo from '@domain/ledger/repos/ledger-account-balance.repo';
import { ILedgerAccountBalance } from '@domain/ledger/types/ledger-account-balance.types';
import currencyEntity from '@domain/money/entities/currency.entity';

interface IDependencies {
  accountingEntityRepo: IAccountingEntityRepo;
  ledgerAccountBalanceRepo: ILedgerAccountBalanceRepo;
  journalEntryRepo: IJournalEntryRepo;
}

/** Enforces owner/jurisdiction uniqueness and prepares entity, event, and audit. */
function makeCreate(deps: IDependencies): IAccountingEntityService['create'] {
  return async (input, repoOptions) => {
    await accountingEntityServiceValidation.validateExistingIndividualEntity(
      deps.accountingEntityRepo,
      input,
      repoOptions
    );

    return accountingEntityEntity.make(input);
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
