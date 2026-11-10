import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import ILedgerAccountBalanceRepo from '@domain/ledger/repos/ledger-account-balance.repo';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';

import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import ledgerAccountMapper from '@app/ledger/dtos/ledger-account/ledger-account.dto.mapper';
import ledgerAppError from '@app/ledger/errors/ledger.error';

/**
 * Loads stored balances in one batch and returns account DTOs in input order.
 * Rejects with BalanceNotFound if any account lacks a stored balance.
 */
export default async function loadLedgerAccountDtosWithBalancesHelper(
  ledgerAccountBalanceRepo: ILedgerAccountBalanceRepo,
  accounts: ILedgerAccount[],
  accountingEntityId: TEntityId,
  repoOptions: IReadRepoOptions
): Promise<ILedgerAccountDto[]> {
  if (accounts.length === 0) {
    return [];
  }

  const balances = await ledgerAccountBalanceRepo.findAllByAccountIds(
    accountingEntityId,
    accounts.map((account) => account.id),
    repoOptions
  );
  const balancesByAccountId = new Map(
    balances.map((balance) => [balance.ledgerAccountId, balance])
  );

  return accounts.map((account) => {
    const balance = balancesByAccountId.get(account.id);

    if (!balance) {
      throw new ledgerAppError.BalanceNotFound({ accountId: account.id });
    }

    return ledgerAccountMapper.toDto(
      account,
      balance.amount,
      balance.functionalAmount
    );
  });
}
