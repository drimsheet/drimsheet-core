import generateUUID from '@shared/utils/uuid-generator';

import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountValidation from '@domain/ledger/entities/validations/ledger-account.validation';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

describe('ledgerAccountValidation', () => {
  it('exposes the frozen ledger-account validators', () => {
    expect(Object.isFrozen(ledgerAccountValidation)).toBe(true);
    expect(ledgerAccountEntity.validateCode).toBe(
      ledgerAccountValidation.validateCode
    );
    expect(Object.keys(ledgerAccountValidation)).toEqual([
      'validateCode',
      'validatePredecessorCode',
      'validatePostingAccountReparenting',
      'validateType',
      'validateStatus',
      'validateContraRule',
      'validateAdjunctRule',
      'validateNormalBalance',
      'validateSubType',
      'validateBehavior',
      'validateIsControlAccount',
      'validateMeta',
      'validateMaterializedPath',
    ]);
    expect(Object.values(ledgerAccountValidation)).toEqual(
      expect.arrayContaining([expect.any(Function)])
    );
  });
  describe('validatePredecessorCode', () => {
    it('accepts a six-digit code in the selected family', () => {
      expect(() =>
        ledgerAccountValidation.validatePredecessorCode('101', '101999')
      ).not.toThrow();
    });

    it.each(['102001', '10100', '101ABC', '1011e2', '101-01', '601001'])(
      'rejects another family or a malformed code: %s',
      (code) => {
        expect(() =>
          ledgerAccountValidation.validatePredecessorCode('101', code)
        ).toThrow(ledgerAccountError.InvalidPredecessorCode);
      }
    );
  });
  describe('validatePostingAccountReparenting', () => {
    function makePostingAccount(currency: ILedgerAccount['currency']) {
      return ledgerAccountEntity.make({
        createdBy: generateUUID(),
        accountingEntityId: generateUUID(),
        code: '401001',
        materializedPath: '401000.401001',
        name: 'Consulting',
        type: 'revenue',
        subType: 'services',
        behavior: 'services',
        normalBalance: 'credit',
        currency,
        status: 'active',
        isControlAccount: false,
        controlAccountId: generateUUID(),
        meta: null,
        contraAccountRule: 'contra_not_permitted',
        adjunctAccountRule: 'adjunct_not_permitted',
      })[0];
    }

    it.each([null, SYSTEM_CURRENCIES.NGN])(
      'accepts a posting account and a matching control parent with currency %o',
      (currency) => {
        const account = makePostingAccount(currency);
        const [controlAccount] =
          ledgerAccountEntity.clonePostingAccountToControlAccount(
            account,
            account.createdBy
          );
        expect(() =>
          ledgerAccountValidation.validatePostingAccountReparenting(
            account,
            controlAccount
          )
        ).not.toThrow();
      }
    );

    it('rejects a control account as the source', () => {
      const account = makePostingAccount(null);
      const [controlAccount] =
        ledgerAccountEntity.clonePostingAccountToControlAccount(
          account,
          account.createdBy
        );
      expect(() =>
        ledgerAccountValidation.validatePostingAccountReparenting(
          controlAccount,
          controlAccount
        )
      ).toThrow(ledgerAccountError.InvalidControlAccount);
    });

    it.each<Partial<ILedgerAccount>>([
      { isControlAccount: false },
      { accountingEntityId: generateUUID() },
      { type: 'expense' },
      { subType: 'grants' },
      { behavior: 'grants' },
      { normalBalance: 'debit' },
      { currency: SYSTEM_CURRENCIES.USD },
      { currency: null },
    ])('rejects an incompatible control parent: %o', (change) => {
      const account = makePostingAccount(SYSTEM_CURRENCIES.NGN);
      const [controlAccount] =
        ledgerAccountEntity.clonePostingAccountToControlAccount(
          account,
          account.createdBy
        );
      expect(() =>
        ledgerAccountValidation.validatePostingAccountReparenting(account, {
          ...controlAccount,
          ...change,
        })
      ).toThrow(ledgerAccountError.InvalidControlAccount);
    });
  });
});
