import { TEntityId } from '@shared/types/uuid';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import {
  EAssetAccountBehavior,
  EAssetSubType,
} from '@domain/ledger/types/asset-account.types';
import { ELedgerType, ILedgerAccount } from '@domain/ledger/types/ledger.types';

/** Validates a supplied cash parent without retrieving or reserving any state. */
function validate(
  controlAccount: ILedgerAccount,
  accountingEntityId: TEntityId,
  behavior: 'bank' | 'petty_cash'
) {
  const isValidControlAccount =
    controlAccount.accountingEntityId === accountingEntityId &&
    controlAccount.type === ELedgerType.Asset &&
    controlAccount.subType === EAssetSubType.CashAndCashEquivalent &&
    controlAccount.isControlAccount &&
    (controlAccount.behavior === EAssetAccountBehavior.DefaultCash ||
      controlAccount.behavior === behavior);

  if (!isValidControlAccount) {
    throw new ledgerAccountError.InvalidControlAccount({
      controlAccountId: controlAccount.id,
      controlAccountLedgerCode: controlAccount.code,
      type: controlAccount.type,
      subType: controlAccount.subType,
      isControlAccount: controlAccount.isControlAccount,
      accountingEntityId,
      controlAccountAccountingEntityId: controlAccount.accountingEntityId,
    });
  }
}

export default Object.freeze({ validate });
