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

export default function makeLedgerAccountPersistenceAppService(
  deps: IDependencies
) {
  const service: ILedgerAccountPersistenceAppService = Object.freeze({
    create: makeCreate(deps),
  });

  return service;
}
