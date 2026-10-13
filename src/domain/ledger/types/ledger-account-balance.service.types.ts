import { ILedgerAccountBalance } from './ledger-account-balance.types';
import { ILedgerAccount } from './ledger.types';

interface IBalanceUpdateInput {
  existingAccount: ILedgerAccount;
  updatedAccount: ILedgerAccount;
  existingBalance: ILedgerAccountBalance;
}

export default interface ILedgerAccountBalanceService {
  /**
   * Aligns the balance denomination with an eligible account currency change.
   * Account eligibility must already be validated by the caller. Returns the
   * original balance for unchanged currency; rejects nonzero redenomination.
   * Performs no reads or writes.
   */
  updateBalance(input: IBalanceUpdateInput): ILedgerAccountBalance;
}
