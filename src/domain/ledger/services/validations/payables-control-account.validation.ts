import { TEntityId } from '@shared/types/uuid';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import { ELedgerType, ILedgerAccount } from '@domain/ledger/types/ledger.types';
import {
  ELiabilityAccountBehavior,
  ELiabilitySubType,
} from '@domain/ledger/types/liability-account.types';

function validateStatutoryPayableSubAccount(
  controlAccount: ILedgerAccount,
  accountingEntityId: TEntityId
) {
  const isValidControlAccount =
    controlAccount.accountingEntityId === accountingEntityId &&
    controlAccount.type === ELedgerType.Liability &&
    controlAccount.subType === ELiabilitySubType.Payable &&
    controlAccount.isControlAccount &&
    (controlAccount.behavior === ELiabilityAccountBehavior.DefaultPayable ||
      controlAccount.behavior === ELiabilityAccountBehavior.TaxPayable) &&
    controlAccount.currency !== null;

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

function validateTradePayableSubAccount(
  controlAccount: ILedgerAccount,
  accountingEntityId: TEntityId
) {
  const isValidControlAccount =
    controlAccount.accountingEntityId === accountingEntityId &&
    controlAccount.type === ELedgerType.Liability &&
    controlAccount.subType === ELiabilitySubType.Payable &&
    controlAccount.isControlAccount &&
    (controlAccount.behavior === ELiabilityAccountBehavior.DefaultPayable ||
      controlAccount.behavior === ELiabilityAccountBehavior.TradePayable);

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

export default Object.freeze({
  validateStatutoryPayableSubAccount,
  validateTradePayableSubAccount,
});
