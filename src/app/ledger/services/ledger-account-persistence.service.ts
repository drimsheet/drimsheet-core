import {
  IRepoService,
  TRepoTransactionFn,
} from '@shared/contracts/repo.contract';
import historyValue from '@shared/values/history/history.vo';

import ledgerAccountBalanceEntity from '@domain/ledger/entities/ledger-account-balance.entity';
import ILedgerAccountBalanceRepo from '@domain/ledger/repos/ledger-account-balance.repo';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import currencyEntity from '@domain/money/entities/currency.entity';

import ILedgerAccountPersistenceService, {
  IAssignedLedgerAccount,
} from '@app/ledger/contracts/ledger-account-persistence.service.contract';
import ILedgerCodeAssignmentAppService from '@app/ledger/contracts/ledger-code-assignment.service.contract';

interface IDependencies {
  ledgerAccountBalanceRepo: ILedgerAccountBalanceRepo;
  ledgerAccountRepo: ILedgerAccountRepo;
  repoService: IRepoService;
  ledgerCodeAssignmentAppService: ILedgerCodeAssignmentAppService;
}

/**
 * Creates a ledger account and its initial balance in the persistence layer.
 * Ensures both records are created within the same transaction.
 * @deprecated Migrate callers to createWithAssignedCode as allocation expands
 * beyond petty cash. Header/bootstrap creation still requires predefined codes.
 */
function makeCreate(
  deps: IDependencies
): ILedgerAccountPersistenceService['create'] {
  return async (account, functionalCurrencyCode, repoOptions) => {
    const functionalCurrency = currencyEntity.getByCode(functionalCurrencyCode);

    const balance = ledgerAccountBalanceEntity.make({
      createdBy: account.createdBy,
      ledgerAccountId: account.id,
      accountingEntityId: account.accountingEntityId,
      accountMaterializedPath: account.materializedPath,
      currencyCode: (account.currency ?? functionalCurrency).code,
      functionalCurrencyCode: functionalCurrency.code,
    });

    const transactionFn: TRepoTransactionFn = async (tx) => {
      const writeOptions = { ...repoOptions, tx };

      await deps.ledgerAccountRepo.create(account, writeOptions);
      await deps.ledgerAccountBalanceRepo.create(balance, writeOptions);
    };

    await deps.repoService.runInTransaction(transactionFn, repoOptions.tx);
  };
}

/**
 * Finalizes a new account under its allocation lock and atomically stores its
 * account, histories and initial balance. Reuses the outer workflow transaction
 * when supplied; its returned account is publishable only after that commit.
 * TODO: Once allocation is rolled out beyond petty cash, replace makeCreate
 * with this operation and consolidate the public API under create. Preserve
 * a path for header/bootstrap accounts with predefined codes.
 */
function makeCreateWithAssignedCode(
  deps: IDependencies
): ILedgerAccountPersistenceService['createWithAssignedCode'] {
  return async (payload, functionalCurrencyCode, repoOptions) => {
    const functionalCurrency = currencyEntity.getByCode(functionalCurrencyCode);
    const transactionFn: TRepoTransactionFn<IAssignedLedgerAccount> = async (
      tx
    ) => {
      const writeOptions = { ...repoOptions, tx };
      const assignment = await deps.ledgerCodeAssignmentAppService.assign(
        {
          account: payload.account,
          allocationHeaderCode: payload.allocationHeaderCode,
        },
        writeOptions
      );
      const [account, events, audit] = assignment;
      const assignmentHistory = historyValue.make(
        audit,
        payload.actorId,
        repoOptions.correlationId
      );

      const balance = ledgerAccountBalanceEntity.make({
        createdBy: account.createdBy,
        ledgerAccountId: account.id,
        accountingEntityId: account.accountingEntityId,
        accountMaterializedPath: account.materializedPath,
        currencyCode: (account.currency ?? functionalCurrency).code,
        functionalCurrencyCode: functionalCurrency.code,
      });

      await deps.ledgerAccountRepo.create(account, {
        ...writeOptions,
        history: [...repoOptions.history, assignmentHistory],
      });
      await deps.ledgerAccountBalanceRepo.create(balance, writeOptions);

      return { account, events };
    };

    return deps.repoService.runInTransaction(transactionFn, repoOptions.tx);
  };
}

export default function makeLedgerAccountPersistenceService(
  deps: IDependencies
) {
  const service: ILedgerAccountPersistenceService = Object.freeze({
    create: makeCreate(deps),
    createWithAssignedCode: makeCreateWithAssignedCode(deps),
  });

  return service;
}
