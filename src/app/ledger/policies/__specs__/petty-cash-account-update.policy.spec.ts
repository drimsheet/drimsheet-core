import { ILedgerAccount } from '@domain/ledger/types/ledger.types';

import ledgerAppError from '@app/ledger/errors/ledger.error';
import pettyCashAccountUpdatePolicy from '@app/ledger/policies/petty-cash-account-update.policy';

describe('pettyCashAccountUpdatePolicy', () => {
  it('accepts an existing account', () => {
    expect(() =>
      pettyCashAccountUpdatePolicy.validateAccountExists(
        'account-id',
        {} as ILedgerAccount
      )
    ).not.toThrow();
  });

  it('rejects a missing account', () => {
    expect(() =>
      pettyCashAccountUpdatePolicy.validateAccountExists('account-id', null)
    ).toThrow(ledgerAppError.AccountNotFound);
  });
});
