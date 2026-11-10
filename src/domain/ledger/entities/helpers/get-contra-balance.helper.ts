import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import {
  ENormalBalance,
  UNormalBalance,
} from '@domain/ledger/types/ledger.types';

export default function getContraLedgerAccountBalanceHelper(
  normalBalance: UNormalBalance
): UNormalBalance {
  switch (normalBalance) {
    case ENormalBalance.Debit:
      return ENormalBalance.Credit;
    case ENormalBalance.Credit:
      return ENormalBalance.Debit;
    default:
      throw new ledgerAccountError.InvalidNormalBalance({ normalBalance });
  }
}
