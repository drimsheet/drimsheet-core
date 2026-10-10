import { ILedgerAccount } from '@domain/ledger/types/ledger.types';

import ledgerAppError from '@app/ledger/errors/ledger.error';
import cashAccountUpdatePolicy from '@app/ledger/policies/cash-account-update.policy';

describe('cashAccountUpdatePolicy', () => {
  it('accepts an existing account', () => {
    expect(() =>
      cashAccountUpdatePolicy.validateAccountExists(
        'account-id',
        {} as ILedgerAccount
      )
    ).not.toThrow();
  });

  it('rejects a missing account', () => {
    expect(() =>
      cashAccountUpdatePolicy.validateAccountExists('account-id', null)
    ).toThrow(ledgerAppError.AccountNotFound);
  });
});
