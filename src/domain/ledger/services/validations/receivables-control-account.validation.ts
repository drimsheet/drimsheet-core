import { TEntityId } from '@shared/types/uuid';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import {
  EAssetAccountBehavior,
  EAssetSubType,
} from '@domain/ledger/types/asset-account.types';
import { ELedgerType, ILedgerAccount } from '@domain/ledger/types/ledger.types';

function validateStatutoryReceivableSubAccount(
  controlAccount: ILedgerAccount,
  accountingEntityId: TEntityId
) {
  const isValidControlAccount =
    controlAccount.accountingEntityId === accountingEntityId &&
    controlAccount.type === ELedgerType.Asset &&
    controlAccount.subType === EAssetSubType.Receivables &&
    controlAccount.isControlAccount &&
    (controlAccount.behavior === EAssetAccountBehavior.DefaultReceivables ||
      controlAccount.behavior === EAssetAccountBehavior.StatutoryReceivable);

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

function validateTradeReceivableSubAccount(
  controlAccount: ILedgerAccount,
  accountingEntityId: TEntityId
) {
  const isValidControlAccount =
    controlAccount.accountingEntityId === accountingEntityId &&
    controlAccount.type === ELedgerType.Asset &&
    controlAccount.subType === EAssetSubType.Receivables &&
    controlAccount.isControlAccount &&
    (controlAccount.behavior === EAssetAccountBehavior.DefaultReceivables ||
      controlAccount.behavior === EAssetAccountBehavior.TradeReceivable);

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
  validateStatutoryReceivableSubAccount,
  validateTradeReceivableSubAccount,
});
