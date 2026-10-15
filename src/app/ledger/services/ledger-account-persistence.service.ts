import {
  IRepoService,
  TRepoTransactionFn,
} from '@shared/contracts/repo.contract';

import ledgerAccountBalanceEntity from '@domain/ledger/entities/ledger-account-balance.entity';
import ILedgerAccountBalanceRepo from '@domain/ledger/repos/ledger-account-balance.repo';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import currencyEntity from '@domain/money/entities/currency.entity';

import ILedgerAccountPersistenceAppService from '@app/ledger/contracts/ledger-account-persistence.service.contract';

interface IDependencies {
  ledgerAccountBalanceRepo: ILedgerAccountBalanceRepo;
  ledgerAccountRepo: ILedgerAccountRepo;
  repoService: IRepoService;
}

/**
 * Creates a ledger account and its initial balance, preserving the supplied code.
 * Ensures both records are created within the same transaction.
 */
function makeCreate(
  deps: IDependencies
): ILedgerAccountPersistenceAppService['create'] {
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

/** Persists promotion records and versioned balances as one atomic bundle. */
function makePromote(
  deps: IDependencies
): ILedgerAccountPersistenceAppService['promote'] {
  return async (promotion, repoOptions) => {
    const [controlAccount] = promotion.controlAccount;
    const [postingAccount] = promotion.postingAccount;
    const transactionFn: TRepoTransactionFn = async (tx) => {
      const writeOptions = { ...repoOptions, tx };
      // The parent FK is checked at commit; this update frees the old code/path.
      await deps.ledgerAccountRepo.update(postingAccount, {
        ...writeOptions,
        expectedVersion: postingAccount.version - 1,
        history: repoOptions.history.find(
          (history) => history.entityId === postingAccount.id
        )!,
      });

      await deps.ledgerAccountRepo.create(controlAccount, {
        ...writeOptions,
        history: repoOptions.history.filter(
          (history) => history.entityId === controlAccount.id
        ),
      });

      await deps.ledgerAccountBalanceRepo.update(promotion.postingBalance, {
        correlationId: repoOptions.correlationId,
        tx,
        expectedVersion: promotion.postingBalance.version - 1,
      });

      await deps.ledgerAccountBalanceRepo.createWithAdjustments(
        {
          balance: promotion.controlBalance,
          adjustments: promotion.controlAdjustments,
        },
        writeOptions
      );
    };
    await deps.repoService.runInTransaction(transactionFn, repoOptions.tx);
  };
}

export default function makeLedgerAccountPersistenceAppService(
  deps: IDependencies
) {
  const service: ILedgerAccountPersistenceAppService = Object.freeze({
    create: makeCreate(deps),
    promote: makePromote(deps),
  });

  return service;
}
