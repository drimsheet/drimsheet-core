import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import {
  ELedgerType,
  ENormalBalance,
  ULedgerType,
  UNormalBalance,
} from '@domain/ledger/types/ledger.types';

export default function getLedgerAccountNormalBalanceHelper(
  type: ULedgerType
): UNormalBalance {
  switch (type) {
    case ELedgerType.Asset:
    case ELedgerType.Expense:
      return ENormalBalance.Debit;
    case ELedgerType.Liability:
    case ELedgerType.Equity:
    case ELedgerType.Revenue:
      return ENormalBalance.Credit;
    default:
      throw new ledgerAccountError.InvalidType({ type });
  }
}
