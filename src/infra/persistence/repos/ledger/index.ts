import accountTransactionQueryRepo from '@infra/persistence/repos/ledger/queries/account-transaction.query.repo.impl';
import ledgerAccountQueryRepo from '@infra/persistence/repos/ledger/queries/ledger-account.query.repo.impl';

import bankAccountRepoImpl from './bank-account.repo.impl';
import ledgerAccountBalanceRepoImpl from './ledger-account-balance.repo.impl';
import ledgerAccountHistoryRepo from './ledger-account-history.repo.impl';
import ledgerAccountRepo from './ledger-account.repo.impl';

const ledgerRepos = {
  ledgerAccount: ledgerAccountRepo,
  bankAccount: bankAccountRepoImpl,
  ledgerAccountBalance: ledgerAccountBalanceRepoImpl,
  ledgerAccountHistory: ledgerAccountHistoryRepo,

  queries: {
    accountTransaction: accountTransactionQueryRepo,
    ledgerAccount: ledgerAccountQueryRepo,
  },
};

export default ledgerRepos;
