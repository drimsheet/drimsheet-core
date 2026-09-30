import { TEntityId } from '@shared/types/uuid';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import {
  EExpenseAccountBehavior,
  EExpenseSubType,
} from '@domain/ledger/types/expense-account.types';
import { ELedgerType, ILedgerAccount } from '@domain/ledger/types/ledger.types';

function validate(
  controlAccount: ILedgerAccount,
  accountingEntityId: TEntityId
) {
  const isValidControlAccount =
    controlAccount.accountingEntityId === accountingEntityId &&
    controlAccount.type === ELedgerType.Expense &&
    controlAccount.subType === EExpenseSubType.LossOnAssetDisposal &&
    controlAccount.isControlAccount &&
    (controlAccount.behavior === EExpenseAccountBehavior.AssetDisposalLoss ||
      controlAccount.behavior === EExpenseAccountBehavior.Default);

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
