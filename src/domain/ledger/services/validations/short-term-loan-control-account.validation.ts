import { TEntityId } from '@shared/types/uuid';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import { ELedgerType, ILedgerAccount } from '@domain/ledger/types/ledger.types';
import {
  ELiabilityAccountBehavior,
  ELiabilitySubType,
} from '@domain/ledger/types/liability-account.types';

function validate(
  controlAccount: ILedgerAccount,
  accountingEntityId: TEntityId
) {
  const isValidControlAccount =
    controlAccount.accountingEntityId === accountingEntityId &&
    controlAccount.type === ELedgerType.Liability &&
    controlAccount.subType === ELiabilitySubType.ShortTermDebt &&
    controlAccount.isControlAccount &&
    (controlAccount.behavior ===
      ELiabilityAccountBehavior.DefaultShortTermDebt ||
      controlAccount.behavior === ELiabilityAccountBehavior.ShortTermLoan);

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

function validateCreditCardSubAccount(
  controlAccount: ILedgerAccount,
  accountingEntityId: TEntityId
) {
  const isValidControlAccount =
    controlAccount.accountingEntityId === accountingEntityId &&
    controlAccount.type === ELedgerType.Liability &&
    controlAccount.subType === ELiabilitySubType.ShortTermDebt &&
    controlAccount.isControlAccount &&
    (controlAccount.behavior ===
      ELiabilityAccountBehavior.DefaultShortTermDebt ||
      controlAccount.behavior === ELiabilityAccountBehavior.CreditCard) &&
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

export default Object.freeze({ validate, validateCreditCardSubAccount });
