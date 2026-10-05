import generateUUID from '@shared/utils/uuid-generator';

import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import validation from '@domain/ledger/services/validations/control-account-availability.validation';

describe('control account availability', () => {
  it.each(['active', 'draft', 'archived'] as const)(
    'checks %s lifecycle status',
    (status) => {
      const [account] = ledgerAccountEntity.make({
        code: '100000',
        materializedPath: '100000',
        accountingEntityId: generateUUID(),
        createdBy: generateUUID(),
        name: 'Cash root',
        type: 'asset',
        subType: 'cash_and_cash_equivalent',
        behavior: 'default_cash',
        normalBalance: 'debit',
        isControlAccount: true,
        controlAccountId: null,
        currency: null,
        status,
        meta: null,
        contraAccountRule: 'contra_permitted',
        adjunctAccountRule: 'adjunct_permitted',
      });
      const check = () => validation.validate(account);
      if (status === 'archived') {
        expect(check).toThrow(ledgerAccountError.ArchivedControlAccount);
      } else {
        expect(check).not.toThrow();
      }
    }
  );
});
