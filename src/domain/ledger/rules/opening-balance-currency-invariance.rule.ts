import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { ICurrency } from '@domain/money/types/currency.types';

function validate(
  account: Pick<ILedgerAccount, 'id' | 'currency'>,
  openingBalanceCurrency: ICurrency
) {
  const accountCurrencyCode = account.currency?.code ?? null;
  const openingBalanceCurrencyCode = openingBalanceCurrency.code;

  if (accountCurrencyCode === openingBalanceCurrencyCode) {
    return;
  }

  throw new ledgerAccountError.OpeningBalanceCurrencyMismatch({
    accountId: account.id,
    accountCurrencyCode,
    openingBalanceCurrencyCode,
  });
}

const openingBalanceCurrencyInvarianceRule = Object.freeze({ validate });

export default openingBalanceCurrencyInvarianceRule;
