import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import validation from '@domain/ledger/services/validations/control-account-child-status.validation';
import { ELedgerAccountStatus } from '@domain/ledger/types/ledger.types';

describe('control account child status', () => {
  it.each(['active', 'archived'] as const)(
    'rejects a %s child of a draft control account',
    (childStatus) => {
      expect(() =>
        validation.validate(ELedgerAccountStatus.Draft, childStatus)
      ).toThrow(ledgerAccountError.NonDraftChildOfDraftControlAccount);
    }
  );

  it.each([
    ['draft', 'draft'],
    ['active', 'draft'],
    ['active', 'active'],
    ['active', 'archived'],
  ] as const)('accepts parent %s and child %s', (parentStatus, childStatus) => {
    expect(() => validation.validate(parentStatus, childStatus)).not.toThrow();
  });
});
