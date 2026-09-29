import { TEntityId } from '@shared/types/uuid';

import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import cashControlAccountValidation from '@domain/ledger/services/validations/cash-control-account.validation';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

const actorId = 'a1111111-1111-4111-8111-111111111111' as TEntityId;
const entityId = 'b1111111-1111-4111-8111-111111111111' as TEntityId;
const [header] = ledgerAccountEntity.make({
  name: 'Cash',
  code: '100000',
  materializedPath: '100000',
  accountingEntityId: entityId,
  createdBy: actorId,
  type: 'asset',
  subType: 'cash_and_cash_equivalent',
  behavior: 'default_cash',
  normalBalance: 'debit',
  isControlAccount: true,
  controlAccountId: null,
  currency: SYSTEM_CURRENCIES.NGN,
  status: 'active',
  meta: null,
  contraAccountRule: 'contra_permitted',
  adjunctAccountRule: 'adjunct_permitted',
});

describe('cashControlAccountValidation', () => {
  it.each(['bank', 'petty_cash'] as const)(
    'allows the cash header and a matching %s parent',
    (behavior) => {
      expect(() =>
        cashControlAccountValidation.validate(header, entityId, behavior)
      ).not.toThrow();
      const [parent] = ledgerAccountEntity.make({
        ...header,
        behavior,
        code: '100010',
        materializedPath: '100000.100010',
        controlAccountId: header.id,
      });
      expect(() =>
        cashControlAccountValidation.validate(parent, entityId, behavior)
      ).not.toThrow();
    }
  );

  it.each([
    { accountingEntityId: actorId },
    { type: 'liability' },
    { subType: 'receivables' },
    { isControlAccount: false },
    { behavior: 'petty_cash' },
  ] as const)(
    'rejects an invalid bank parent with its context: %o',
    (invalid) => {
      const parent = { ...header, ...invalid };
      expect(() =>
        cashControlAccountValidation.validate(parent, entityId, 'bank')
      ).toThrow(
        expect.objectContaining({
          errorKey: 'ledger_error_asset_account_control_account_invalid',
          cause: {
            controlAccountId: parent.id,
            controlAccountLedgerCode: parent.code,
            type: parent.type,
            subType: parent.subType,
            isControlAccount: parent.isControlAccount,
            accountingEntityId: entityId,
            controlAccountAccountingEntityId: parent.accountingEntityId,
          },
        })
      );
    }
  );
});
