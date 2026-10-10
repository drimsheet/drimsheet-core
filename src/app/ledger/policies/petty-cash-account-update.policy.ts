import { ILedgerAccount } from '@domain/ledger/types/ledger.types';

import ledgerAppError from '@app/ledger/errors/ledger.error';

interface IPettyCashAccountUpdatePolicy {
  validateAccountExists(
    id: string,
    account: ILedgerAccount | null
  ): asserts account is ILedgerAccount;
}

/** Ensures the account selected for the update exists. */
function validateAccountExists(
  id: string,
  account: ILedgerAccount | null
): asserts account is ILedgerAccount {
  if (account) {
    return;
  }

  throw new ledgerAppError.AccountNotFound({ id });
}

const pettyCashAccountUpdatePolicy: IPettyCashAccountUpdatePolicy =
  Object.freeze({ validateAccountExists });

export default pettyCashAccountUpdatePolicy;
