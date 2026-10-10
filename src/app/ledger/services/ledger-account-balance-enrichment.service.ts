import IReporter from '@shared/contracts/reporter.contract';

import ILedgerAccountBalanceRepo from '@domain/ledger/repos/ledger-account-balance.repo';
import currencyEntity from '@domain/money/entities/currency.entity';
import moneyValue from '@domain/money/values/money.vo';

import ILedgerAccountBalanceEnrichmentAppService from '@app/ledger/contracts/ledger-account-balance-enrichment.service.contract';
import ledgerAccountMapper from '@app/ledger/dtos/ledger-account/ledger-account.dto.mapper';
import ledgerAppError from '@app/ledger/errors/ledger.error';

interface IDependencies {
  ledgerAccountBalanceRepo: ILedgerAccountBalanceRepo;
  reporter: IReporter;
}

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

      if (balance) {
        return ledgerAccountMapper.toDto(
          account,
          balance.amount,
          balance.functionalAmount
        );
      }

      deps.reporter.report(
        'ledger.balance_enrichment.failed',
        new ledgerAppError.BalanceNotFound({ accountId: account.id })
      );

      const functionalCurrency = currencyEntity.getByCode(
        accountingEntity.functionalCurrencyCode
      );
      const zeroBalance = moneyValue.makeZeroAmount(
        account.currency ?? functionalCurrency
      );
      const zeroFunctionalBalance =
        moneyValue.makeZeroAmount(functionalCurrency);

      return ledgerAccountMapper.toDto(
        account,
        zeroBalance,
        zeroFunctionalBalance
      );
    });
  };
}

export default function makeLedgerAccountBalanceEnrichmentAppService(
  deps: IDependencies
): ILedgerAccountBalanceEnrichmentAppService {
  return Object.freeze({ enrich: makeEnrich(deps) });
}
