import ILedgerAccountBalanceRepo from '@domain/ledger/repos/ledger-account-balance.repo';

import ILedgerAccountBalanceEnrichmentAppService from '@app/ledger/contracts/ledger-account-balance-enrichment.service.contract';
import ledgerAccountMapper from '@app/ledger/dtos/ledger-account/ledger-account.dto.mapper';
import ledgerAppError from '@app/ledger/errors/ledger.error';

interface IDependencies {
  ledgerAccountBalanceRepo: ILedgerAccountBalanceRepo;
}

/**
 * Maps stored balances onto accounts; rejects if any account has no balance.
 */
function makeEnrich(
  deps: IDependencies
): ILedgerAccountBalanceEnrichmentAppService['enrich'] {
  return async (accounts, accountingEntity, repoOptions) => {
    if (accounts.length === 0) {
      return [];
    }

    const balances = await deps.ledgerAccountBalanceRepo.findAllByAccountIds(
      accountingEntity.id,
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
  };
}

export default function makeLedgerAccountBalanceEnrichmentAppService(
  deps: IDependencies
): ILedgerAccountBalanceEnrichmentAppService {
  return Object.freeze({ enrich: makeEnrich(deps) });
}
